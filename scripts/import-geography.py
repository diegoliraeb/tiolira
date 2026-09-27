"""Import public reference data downloaded into /tmp/tiolira-geography."""
import json, gzip, shutil
from pathlib import Path
source=Path('/tmp/tiolira-geography'); output=Path('public/geography')
countries=json.loads((source/'countries.json').read_text())
states=json.loads((source/'states.json').read_text())
cities=json.loads(gzip.decompress((source/'cities.json.gz').read_bytes()))
br=json.loads((source/'br-cities.json').read_text())
result={c['iso2']:{'name':c['name'],'states':{}} for c in countries}
for s in states:
 if s['country_code']=='BR':continue
 result[s['country_code']]['states'][str(s['id'])]={'name':s['name'],'code':s['iso2'] or '', 'cities':[]}
for c in cities:
 if c['country_code']=='BR':continue
 country=result.get(c['country_code']); state=country['states'].get(str(c['state_id'])) if country else None
 if state is not None:state['cities'].append([str(c['id']),c['name']])
for c in br:
 uf=c['regiao-imediata']['regiao-intermediaria']['UF']
 state=result['BR']['states'].setdefault(uf['sigla'],{'name':uf['nome'],'code':uf['sigla'],'region':uf['regiao']['nome'],'cities':[]})
 state['cities'].append([str(c['id']),c['nome']])
for code,country in result.items():
 for state in country['states'].values():state['cities'].sort(key=lambda c:c[1])
 (output/(code+'.json')).write_text(json.dumps(country,ensure_ascii=False,separators=(',',':')))
metadata=[{'code':c['iso2'],'name':c['name']} for c in countries]
Path('data/geography/countries.json').write_text(json.dumps(metadata,ensure_ascii=False,separators=(',',':')))
Path('data/geography/br-states.json').write_text(json.dumps([{'id':key,**{k:v for k,v in s.items() if k!='cities'}} for key,s in result['BR']['states'].items()],ensure_ascii=False,separators=(',',':')))
shutil.copyfile(source/'LICENSE',output/'LICENSE.txt')
(output/'README.txt').write_text('Location data: https://github.com/dr5hn/countries-states-cities-database (ODbL 1.0; see LICENSE.txt). Simplified country/state/city snapshot, retrieved 2026-09-27. Brazil municipalities and regional divisions replaced with IBGE data: https://servicodados.ibge.gov.br/api/docs/localidades. These adapted database files are available here under ODbL 1.0. No store or personal information is included.\n')
print(f'{len(result)} countries; {len(br)} Brazilian municipalities; {sum(p.stat().st_size for p in output.glob("*.json"))} bytes')
