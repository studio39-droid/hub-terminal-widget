from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')

if 'const fallbackVocab=[' not in s:
    s, count = re.subn(r'// Vocabulary MVP\nconst vocab=\[', '// Vocabulary\nconst fallbackVocab=[', s, count=1)
    if count != 1:
        raise SystemExit('Could not find vocabulary block start.')
    marker = "];\nconst vocabWord=q('#vocabWord')"
    if marker not in s:
        raise SystemExit('Could not find vocabulary block end.')
    s = s.replace(marker, "];\nlet vocab=[...fallbackVocab];\nconst vocabWord=q('#vocabWord')", 1)

if 'async function loadVocab()' not in s:
    marker = 'function makeChoices(item){\n'
    loader = """async function loadVocab(){\n  try{\n    const response=await fetch('./vocab.json',{cache:'no-store'});\n    if(!response.ok)throw new Error('HTTP '+response.status);\n    const data=await response.json();\n    if(Array.isArray(data)&&data.length>=3)vocab=data;\n  }catch(e){console.warn('Vocabulary sync fallback:',e)}\n  showWord();\n}\n"""
    if marker not in s:
        raise SystemExit('Could not find makeChoices().')
    s = s.replace(marker, loader + marker, 1)

old = 'applyClock();tickClock();setInterval(tickClock,1000);render();weather();setInterval(weather,900000);showWord();'
new = 'applyClock();tickClock();setInterval(tickClock,1000);render();weather();setInterval(weather,900000);loadVocab();'
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('Could not update vocabulary initialization.')

path.write_text(s, encoding='utf-8')
print('index.html patched for vocab.json loading (with embedded fallback).')
