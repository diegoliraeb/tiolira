"""Import complete Bambu Studio profiles. Manifest stays private; only totals ship.
Usage: python3 scripts/import-print-estimates.py manifest.json output.json
Each entry: id, source (3MF), filePath, url, optional gcodes (complete plate list).
"""
import json, pathlib, re, sys, zipfile, hashlib, xml.etree.ElementTree as ET
from datetime import datetime, timezone

def gcode_stats(header, fallback_grams=None):
    time=re.search(r'total estimated time:\s*([^\r\n;]+)',header)
    weight=re.search(r'total filament weight \[g\]\s*:\s*([\d., ]+)',header)
    if not time:raise ValueError('Missing slicer time')
    seconds=sum(float(n)*{'d':86400,'h':3600,'m':60,'s':1}[unit] for n,unit in re.findall(r'(\d+(?:\.\d+)?)\s*([dhms])',time.group(1)))
    grams=sum(float(n) for n in weight.group(1).split(',') if n.strip()) if weight else 0
    if grams<=0 and fallback_grams is not None:grams=fallback_grams
    if seconds<=0 or grams<=0:raise ValueError('Invalid slicer totals')
    return grams,seconds

def inspect(row):
    z=zipfile.ZipFile(row['source'])
    settings=json.loads(z.read('Metadata/project_settings.config'))
    model=ET.fromstring(z.read('Metadata/model_settings.config'))
    plates=[p for p in model.findall('plate') if p.findall('model_instance')]
    if not plates:raise ValueError('No model plates')
    names=row.get('gcodes') or sorted(n for n in z.namelist() if re.fullmatch(r'Metadata/plate_\d+\.gcode',n))
    if len(names)!=len(plates):raise ValueError(f'Incomplete slicing: {len(names)}/{len(plates)} plates')
    slice_info=ET.fromstring(z.read('Metadata/slice_info.config')) if 'Metadata/slice_info.config' in z.namelist() else None
    sliced={}
    for plate in slice_info.findall('plate') if slice_info is not None else []:
        meta={x.get('key'):x.get('value') for x in plate.findall('metadata')}
        sliced[meta.get('index')]=(sum(float(f.get('used_g','0')) for f in plate.findall('filament')),float(meta.get('prediction') or 0))
    totals=[]
    for n in names:
        with (open(n,'rb') if row.get('gcodes') else z.open(n)) as f:header=f.read(10000).decode('utf8',errors='replace')
        fallback=None
        if not row.get('gcodes'):
            idx=re.search(r'plate_(\d+)\.gcode',n).group(1)
            if idx in sliced:fallback=sliced[idx][0]
        stats=gcode_stats(header,fallback)
        if not row.get('gcodes') and idx in sliced and abs(stats[1]-sliced[idx][1])>2:raise ValueError('Slicer metadata and G-code time disagree')
        totals.append(stats)
    printer=settings.get('printer_settings_id') or settings.get('printer_model') or 'Bambu Studio'
    if isinstance(printer,list):printer=', '.join(printer)
    return {'grams':round(sum(x[0] for x in totals),2),'seconds':round(sum(x[1] for x in totals)), 'plates':len(totals),'printer':printer,'material':', '.join(dict.fromkeys(settings.get('filament_type',[]))) if isinstance(settings.get('filament_type',[]),list) else settings.get('filament_type',''),'layer':str(settings.get('layer_height','')),'source':pathlib.Path(row['source']).name,'checkedAt':datetime.now(timezone.utc).isoformat(),'filePath':row.get('filePath',''),'url':row.get('url','')}

if __name__=='__main__':
    rows=json.loads(pathlib.Path(sys.argv[1]).read_text());out={};missing=[]
    for row in rows:
        try:out[row['id']]=inspect(row);print('OK',row['name'],out[row['id']]['grams'],out[row['id']]['seconds'],flush=True)
        except Exception as e:missing.append({**row,'error':str(e)});print('PENDING',row['name'],str(e),flush=True)
        pathlib.Path(sys.argv[2]).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
        pathlib.Path(sys.argv[2]+'.pending.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2))
