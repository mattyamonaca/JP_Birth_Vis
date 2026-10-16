from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, unquote
import json
import re

root=Path(__file__).resolve().parents[1]
base='https://mattyamonaca.github.io/JP_Birth_Vis/'
class References(HTMLParser):
    def __init__(self):
        super().__init__(); self.references=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        for key in ['src','href']:
            if key in attrs:self.references.append((tag,attrs[key]))
parser=References();parser.feed((root/'index.html').read_text())
checked=[]
for tag,ref in parser.references:
    if ref.startswith(('https:','http:','#','data:','mailto:')):
        assert tag not in ['script','link'], 'Remote executable/style dependency: '+ref
        continue
    target=urlparse(urljoin(base,ref)).path
    assert target.startswith('/JP_Birth_Vis/'),target
    relative=unquote(target[len('/JP_Birth_Vis/'):]) or 'index.html'
    assert (root/relative).exists(),relative
    checked.append(relative)
app=(root/'app.mjs').read_text()
for ref in re.findall(r"(?:fetch\(|from )['\"]([^'\"]+)['\"]",app):
    assert ref.startswith('./'),ref
    assert (root/ref).is_file(),ref
    assert urljoin(base,ref).startswith(base)
    checked.append(ref)
css=(root/'style.css').read_text()
assert '@import' not in css
assert 'fonts.googleapis.com' not in css
assert 'createObjectURL' in (root/'assets/maplibre-gl.js').read_text()
for path in root.rglob('*'):
    if '.git' in path.parts or '_site' in path.parts:continue
    assert path.name not in ['AGENTS.md','.openai','.env'],path
    assert not path.name.startswith('.env.'),path
    assert not path.is_symlink(),path
dataset=json.loads((root/'data/facilities.json').read_text())
assert len(dataset['facilities'])==len({f['id'] for f in dataset['facilities']})
assert (root/'.nojekyll').is_file()
print('PASS: project-subpath assets, relative fetch/import, local worker/dependencies, publication allowlist, unique IDs')
print('Checked:',', '.join(checked))
