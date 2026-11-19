from pathlib import Path
import tempfile, subprocess, json, struct, shutil, time, importlib.util, sys
sys.dont_write_bytecode = True

root=Path('.').resolve()
origin='chrome-extension://'+'a'*32+'/'
with tempfile.TemporaryDirectory(prefix='native-video-',dir='.') as temp:
    stage=Path(temp).resolve()
    shutil.copy2(root/'MediaNativeHost.exe',stage)
    (stage/'media-native-host.json').write_text(json.dumps({'allowed_origins':[origin,'chrome-extension://'+'b'*32+'/']}))
    (stage/'Start-Media-Background.ps1').write_text("[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'test-started.txt'),'ok')")
    def invoke(data,caller=origin):
        payload=json.dumps(data).encode()
        result=subprocess.run([str(stage/'MediaNativeHost.exe'),caller],input=struct.pack('<I',len(payload))+payload,capture_output=True,timeout=15)
        assert result.returncode==0 and not result.stderr,result
        size=struct.unpack('<I',result.stdout[:4])[0]
        assert size==len(result.stdout)-4
        return json.loads(result.stdout[4:])
    assert not invoke({'action':'start'},'chrome-extension://'+'c'*32+'/')['ok']
    assert not invoke({'action':'start','command':'calc.exe'})['ok']
    assert not invoke({'action':'stop'})['ok']
    assert not (stage/'test-started.txt').exists()
    assert invoke({'action':'start'})['ok']
    for _ in range(80):
        if (stage/'test-started.txt').exists(): break
        time.sleep(.1)
    assert (stage/'test-started.txt').read_text()=='ok'
    assert invoke({'action':'start'},'chrome-extension://'+'b'*32+'/')['ok']
    config=json.loads((stage/'media-bridge-config.json').read_text())
    assert set(config['extensionIds'])=={'a'*32,'b'*32}
    # Isolated bridge import: no listener, no real video, no user profiles.
    shutil.copy2(root/'media-bridge.py',stage)
    spec=importlib.util.spec_from_file_location('bridge_test',stage/'media-bridge.py')
    bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
    assert 'chrome-extension://'+'b'*32 in bridge.paired_origins()
    (stage/'media-bridge-config.json').write_text(json.dumps({'extensionIds':['d'*32,'bad','https://example.com']}))
    assert bridge.paired_origins()=={'chrome-extension://'+'d'*32}
    (stage/'media-bridge-config.json').write_text('invalid')
    assert bridge.paired_origins()==set()
    time.sleep(.5)
print('PASS native binary framing, origin/action rejection, hidden mock launch, multi-ID merge and dynamic bridge pairing')
