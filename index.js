const mysql = require('mysql');
const fs = require('fs');
const util = require('util');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'allall',
    database: 'armata'
});
const query = util.promisify(connection.query).bind(connection);
const layoutTemplate = fs.readFileSync('index.html', 'utf8');

fs.rmdirSync('docs', { recursive: true });
fs.mkdirSync('docs');
fs.mkdirSync('docs/assets');
fs.copyFileSync('./assets/logo.png', './docs/assets/logo.png');
fs.copyFileSync('./assets/styles.css', './docs/assets/styles.css');
fs.copyFileSync('./CNAME', './docs/CNAME');

async function exportVideos() {
    const rows = await query('SELECT * FROM ag_videos ORDER BY timestamp ASC');
    let videosContent = ``;
    rows.forEach( (row, r) => {
        const date = new Date(row.timestamp).toLocaleDateString("fr-CA");
        const desc = (row.description || '').replace(/(<([^>]+)>)/gi, "");
        videosContent += `
            <div class="video">
                <div class="video-heading">
                    <div class="video-title">
                        <a href="${row.source}" target="_blank">${row.title}</a>
                    </div>
                    <div>${date}</div>
                </div>
                <div class="video-description">${desc}</div>
            </div>
            `;
    });
    fs.writeFileSync(`docs/videos.html`, layoutTemplate
        .replace(/{{ title }}/g, 'Vidéos')
        .replace('{{ content }}', videosContent));
}

async function exportMembers() {
    const rows = await query('SELECT * FROM ag_users WHERE comment_count IS NOT NULL ORDER BY joindate ASC');
    let membersContent = `
        <table width="100%">
            <tr>
                <th>#</th>
                <th>Nom</th>
                <th>Membre depuis</th>
                <th>Messages</th>
            </tr>`;
    rows.forEach( (row, r) => {
        const date = new Date(row.joindate).toLocaleDateString("fr-CA");
        membersContent += `
            <tr>
                <td>${r + 1}</td>
                <td>${row.username}</td>
                <td>${date}</td>
                <td>${row.comment_count}</td>
            </tr>
            `;
    });
    membersContent += '</table>';
    fs.writeFileSync(`docs/members.html`, layoutTemplate
        .replace(/{{ title }}/g, 'Membres')
        .replace('{{ content }}', membersContent));
}

async function exportBlog() {
    const rows = await query('SELECT * FROM ag_articles WHERE type = 0 ORDER BY timestamp ASC');
    let indexContent = '';
    for await (const row of rows) {
        const blog_title = row.title_fr;
        const blog_summary = row.summary_fr || '';
        const blog_content = row.body_fr || '';
        const comments = await query(`SELECT c.*, u.username FROM ag_comments c LEFT JOIN ag_users u ON c.author_id = u.id WHERE c.parent_id = ${row.id} ORDER BY timestamp ASC`);
        let contentTemplate = `
<div class="sub-title">Article</div>
<div class="blog_summary">${ blog_summary }</div>
<div class="blog_body">${ blog_content }</div>
            `;

        if (comments.length > 0) {
            contentTemplate += '<h2 class="blog_comments">Commentaires</h2>';
        }

        let m = 1;
        comments.forEach(comment => {
            const messageDate = new Date(comment.timestamp).toLocaleDateString("fr-CA") + ' @ ' + new Date(comment.timestamp).toLocaleTimeString();
            contentTemplate += `
<div class="forum-message">
<div class="sub-title">Message #${m} le <i>${messageDate}</i> par <strong>${comment.username}:</strong></div>
<div class="message-body">${comment.body}</div>
</div>`;
            m++;
        });

        const pageTemplate = layoutTemplate
            .replace('{{ content }}', contentTemplate)
            .replace(/{{ title }}/g, blog_title);
        const fileName = `article-${row.slug_fr}.html`;
        fs.writeFileSync(`docs/${fileName}`, pageTemplate);
        const date = new Date(row.timestamp).toLocaleDateString("fr-CA");
        indexContent += `
<div class="page_link">
    <span class="page_timestamp">${date}</span>
    <a href="${fileName}">${blog_title}</a>
</div>`;
    }
    const indexTemplate = layoutTemplate
        .replace(/{{ title }}/g, 'Articles')
        .replace('{{ content }}', indexContent);
    fs.writeFileSync(`docs/index.html`, indexTemplate);
}

async function exportPages() {
    const rows = await query('SELECT * FROM ag_articles WHERE id = 20');
    rows.forEach( (row) => {
        const blog_title = row.title_fr;
        const blog_summary = row.summary_fr || '';
        const blog_content = row.body_fr || '';
        const contentTemplate = `
<div class="sub-title">Page</div>
<div class="blog_summary">${ blog_summary }</div>
<div class="blog_body">${ blog_content }</div>
            `;
        const pageTemplate = layoutTemplate
            .replace('{{ content }}', contentTemplate)
            .replace(/{{ title }}/g, blog_title);
        const fileName = `a-propos.html`;
        fs.writeFileSync(`docs/${fileName}`, pageTemplate);
    });
}

async function exportForums() {
    const rows = await query('SELECT * FROM ag_forums WHERE id != 37 ORDER BY name_fr');
    let indexContent = '';
    for await (const row of rows) {
        const fileName = `forum-${row.id}.html`;
        const topics = await query(`SELECT * FROM ag_topics WHERE forum_id = ${row.id} ORDER BY timestamp ASC`);
        let forumContent = `
        <table width="100%">
            <tr>
                <th>Discussion</th>               
                <th>Date</th>
                <th>Messages</th>
            </tr>`;

        for await (const topic of topics) {
            const date = new Date(topic.timestamp).toLocaleDateString("fr-CA");
            const topicFileName = `topic-${topic.id}.html`;
            forumContent += `
            <tr>
            <td><a href="${topicFileName}">${topic.title}</a></td>
            <td>${date}</td>
            <td>${topic.comment_count}</td>
            </tr>
            `;

            let topicContent = '';

            // messages
            const messages = await query(`SELECT c.*, u.username FROM ag_comments c LEFT JOIN ag_users u ON c.author_id = u.id WHERE c.parent_id = ${topic.id} ORDER BY timestamp ASC`);
            let m = 1;
            for (const message of messages) {
                const messageDate = new Date(message.timestamp).toLocaleDateString("fr-CA") + ' @ ' + new Date(message.timestamp).toLocaleTimeString();
                topicContent += `
<div class="forum-message">
<div class="sub-title">Message #${m} le <i>${messageDate}</i> par <strong>${message.username}:</strong></div>
<div class="message-body">${message.body}</div>
</div>`;
                m++;
            }
            const messageTemplate = layoutTemplate
                .replace('{{ content }}', topicContent)
                .replace(/{{ title }}/g, topic.title);
            fs.writeFileSync(`docs/${topicFileName}`, messageTemplate);
        }

        forumContent += '</table>';

        const pageTemplate = layoutTemplate
            .replace('{{ content }}', forumContent)
            .replace(/{{ title }}/g, row.name_fr);
        fs.writeFileSync(`docs/${fileName}`, pageTemplate);

        indexContent += `
        <div class="page_link">
            <span></span>
            <a href="${fileName}">${row.name_fr}</a>
        </div>`;
    }
    const indexTemplate = layoutTemplate
        .replace(/{{ title }}/g, 'Forum')
        .replace('{{ content }}', indexContent);
    fs.writeFileSync(`docs/forum.html`, indexTemplate);
}

(async () => {
    try {
        await exportVideos();
        await exportMembers();
        await exportBlog();
        await exportPages();
        await exportForums();
    } finally {
        connection.end();
    }
})();
