import fs from 'node:fs/promises';

const token = process.env.NOTION_TOKEN;
const dataSourceId = process.env.NOTION_VOCAB_DATA_SOURCE_ID || '8345f227-91fd-49e6-b6a8-2c7e42c80302';

if (!token) {
  console.error('NOTION_TOKEN is required');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2025-09-03'
};

const richText = prop => (prop?.rich_text || []).map(x => x.plain_text || '').join('').trim();
const title = prop => (prop?.title || []).map(x => x.plain_text || '').join('').trim();

async function queryAll() {
  const results = [];
  let cursor;
  do {
    const body = {
      page_size: 100,
      filter: { property: 'Enabled', checkbox: { equals: true } }
    };
    if (cursor) body.start_cursor = cursor;

    const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Notion query failed: ${response.status} ${await response.text()}`);

    const json = await response.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return results;
}

const pages = await queryAll();
const vocab = pages.map(page => {
  const p = page.properties || {};
  return {
    word: title(p.Word),
    meaning: richText(p.Meaning),
    explain: richText(p['Short Explanation']),
    cat: (p.Category?.multi_select || []).map(x => x.name).join(' · '),
    detail: page.url || ''
  };
}).filter(item => item.word && item.meaning)
  .sort((a, b) => a.word.localeCompare(b.word, 'en'));

await fs.writeFile('vocab.json', JSON.stringify(vocab, null, 2) + '\n', 'utf8');
console.log(`Synced ${vocab.length} vocabulary items.`);
