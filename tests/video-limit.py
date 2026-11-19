import sys,importlib.util,json,tempfile
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('bridge',Path('media-bridge.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
manifest={'schema':'desk.media/1','kind':'reel','sourceUrl':'https://www.facebook.com/reel/123456'}
def runner(info):return lambda *a,**k:SimpleNamespace(returncode=0,stdout=json.dumps(info).encode(),stderr=b'')
assert m.MAX_MB==200 and '200M' in m.FORMAT
assert m.probe(manifest,runner({'filesize':100*1024*1024}))['status']=='ok'
assert m.probe(manifest,runner({'filesize':201*1024*1024}))['status']=='too_big'
assert m.probe(manifest,runner({'filesize_approx':300*1024*1024}))['status']=='unknown'
assert m.probe(manifest,runner({'id':'123'}))['status']=='unknown'
with tempfile.TemporaryDirectory(dir='work') as folder:
 try:m.prepare_mp4(manifest,folder,run=lambda *a,**k:SimpleNamespace(returncode=1,stderr=b'Requested format is not available'))
 except ValueError as error:assert 'vượt' not in str(error)
 else:raise AssertionError('Expected format error')
print('PASS 200 MB probe: 100 MB accepted, exact 201 MB rejected, estimates/unknown are not false oversize, missing format is not size error')
