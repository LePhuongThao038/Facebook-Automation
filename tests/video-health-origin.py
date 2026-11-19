import importlib.util, threading, http.client, sys
sys.dont_write_bytecode = True
from pathlib import Path
from http.server import ThreadingHTTPServer

path=Path('media-bridge.py')
spec=importlib.util.spec_from_file_location('bridge',path)
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
server=ThreadingHTTPServer(('127.0.0.1',0),bridge.Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
def request(method,path,headers=None):
    conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
    conn.request(method,path,headers={'Host':'127.0.0.1:47833',**(headers or {})})
    response=conn.getresponse(); data=response.read();status=response.status;conn.close()
    return status,data
try:
    assert request('GET','/health')[0]==200,'Chrome extension GET without Origin must succeed'
    assert request('GET','/health',{'Origin':'https://example.com'})[0]==403
    assert request('GET','/health',{'Origin':'chrome-extension://'+'z'*32})[0]==403
    assert request('POST','/prepare')[0]==403,'Media still requires paired Origin'
    assert request('POST','/probe')[0]==403
    assert request('GET','/health',{'Host':'example.com'})[0]==403
    assert request('GET','/not-health')[0]==403
finally:
    server.shutdown();server.server_close();thread.join()
print('PASS real HTTP: originless health GET; reject unpaired websites/extensions, incorrect Host, originless media POST and unknown endpoint')
