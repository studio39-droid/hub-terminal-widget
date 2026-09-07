from pathlib import Path
import re,sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
t=p.read_text(encoding='utf-8'); original=t
# Grid: Clock + Timer + Weather only.
t=t.replace('grid-template-columns:170px minmax(390px,1fr) 290px minmax(300px,340px);','grid-template-columns:170px minmax(390px,1fr) 290px;')
t=t.replace('.panel,.weather,.vocab{','.panel,.weather{').replace('.clock,.panel,.weather,.vocab{height:184px}', '.clock,.panel,.weather{height:184px}').replace('.grid{grid-template-columns:1fr}.clock,.panel,.weather,.vocab{height:auto;min-height:160px}', '.grid{grid-template-columns:1fr}.clock,.panel,.weather{height:auto;min-height:160px}')
# Remove Vocabulary CSS block.
t=re.sub(r'\n/\* Vocabulary card \*/.*?(?=\n\n\.meterHead\{)', '\n', t, flags=re.S)
# Remove standalone Vocabulary card markup.
t=re.sub(r'\n\s*<section class="vocab">.*?</section>(?=\s*</div>\s*</div>\s*<script src="\./hub-session\.js")', '', t, count=1, flags=re.S)
# Remove Vocabulary JS, but keep Init for core.
a=t.find('// Vocabulary'); b=t.find('// Init',a)
if a<0 or b<0: raise SystemExit('ERROR: Vocabulary/Init marker missing')
t=t[:a]+t[b:]
t=t.replace('render();weather();setInterval(weather,900000);loadVocab();','render();weather();setInterval(weather,900000);')
if 'class="vocab"' in t or '// Vocabulary' in t or 'loadVocab()' in t: raise SystemExit('ERROR: Vocabulary removal incomplete')
backup=p.with_suffix(p.suffix+'.before-v5.1')
backup.write_text(original,encoding='utf-8');p.write_text(t,encoding='utf-8')
print('patched:',p);print('backup:',backup)
