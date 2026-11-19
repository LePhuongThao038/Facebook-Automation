from pathlib import Path
import tempfile,subprocess,struct,json,os,shutil
root=Path('.').resolve()
with tempfile.TemporaryDirectory(prefix='csv-native-',dir='work') as folder:
 stage=Path(folder).resolve()
 # Compile the same host with only its fixed output root redirected to test space.
 source=(root/'DeskNativeHost.cs').read_text(encoding='utf-8').replace('Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)','@"'+str(stage).replace('"','""')+'"')
 (stage/'Host.cs').write_text(source,encoding='utf-8')
 def quote(path):return "'"+str(path).replace("'","''")+"'"
 compile_command='Add-Type -Path '+quote(stage/'Host.cs')+" -ReferencedAssemblies 'System.dll','System.Core.dll','System.Web.Extensions.dll' -OutputAssembly "+quote(stage/'DeskNativeHost-3_7_1.exe')+' -OutputType ConsoleApplication'
 subprocess.run(['powershell.exe','-NoProfile','-Command',compile_command],check=True,capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
 origin='chrome-extension://'+'a'*32+'/'
 (stage/'media-native-host.json').write_text(json.dumps({'allowed_origins':[origin]}))
 env={**os.environ,'LOCALAPPDATA':str(stage)}
 def host():return subprocess.Popen([str(stage/'DeskNativeHost-3_7_1.exe'),origin],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
 def call(p,value):
  b=json.dumps(value,ensure_ascii=True).encode();p.stdin.write(struct.pack('<I',len(b))+b);p.stdin.flush();size=struct.unpack('<I',p.stdout.read(4))[0];return json.loads(p.stdout.read(size))
 profile='11111111-1111-4111-8111-111111111111'
 csv='\ufeffNội dung,Trạng thái\r\n"Xin chào 😊",đã đăng\r\n'+'Caption dài\n'*20000
 p=host();result=call(p,{'action':'csv-begin','profile':profile,'name':'Tab: Nhân vật A/1','chars':len(csv.encode('utf-16-le'))//2})
 if not result['ok']:p.stdin.close();p.wait(5)
 assert result['ok'],result
 chunks=[csv[i:i+32000] for i in range(0,len(csv),32000)]
 for index,chunk in enumerate(chunks):assert call(p,{'action':'csv-chunk','index':index,'text':chunk})['ok']
 result=call(p,{'action':'csv-commit','chunks':len(chunks)});assert result['ok'],result
 path=Path(result['path']);assert path.is_relative_to(stage);assert path.read_bytes()==csv.encode('utf-8')
 assert ':' not in path.name and '/' not in path.name
 p.stdin.close();assert p.wait(5)==0
 # Interrupted save must preserve the previous complete file.
 p=host();assert call(p,{'action':'csv-begin','profile':profile,'name':'Tab: Nhân vật A/1','chars':100})['ok']
 assert call(p,{'action':'csv-chunk','index':0,'text':'partial'})['ok']
 assert not call(p,{'action':'csv-commit','chunks':1})['ok']
 p.stdin.close();p.wait(5);assert path.read_bytes()==csv.encode('utf-8')
 p=host();assert not call(p,{'action':'csv-begin','profile':'../../escape','name':'bad','chars':0})['ok'];assert not call(p,{'action':'arbitrary-command','command':'calc.exe'})['ok'];p.stdin.close();p.wait(5)
 assert not list(stage.rglob('*.tmp'))
print('PASS native CSV streaming, UTF-8/emoji, safe tab filename, complete commit, interrupted write preservation and command/path rejection')
