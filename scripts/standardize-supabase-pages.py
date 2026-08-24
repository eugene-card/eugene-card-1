from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co'
CANONICAL_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3'
OLD_URL = 'https://kbxqmgdnzxwshyzasssr.supabase.co'
OLD_KEY = 'sb_publishable__tPM9ty9ELyh3X70Hl1S-Q_7hWvPe2R'

for path in ROOT.glob('*.html'):
    text = path.read_text(encoding='utf-8')
    original = text
    text = text.replace(OLD_URL, CANONICAL_URL).replace(OLD_KEY, CANONICAL_KEY)
    text = text.replace('eugene.aquila06@gmail.com\', \'yujinybwork@gmail.com\', \'eugene.aquila06\', \'admin house', 'eugene.aquila06@gmail.com\', \'eugenecard.market@gmail.com')
    text = text.replace('eugene.aquila06@gmail.com', 'eugene.aquila06@gmail.com')
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(f'updated {path.name}')
