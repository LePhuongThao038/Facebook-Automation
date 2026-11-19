using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Web.Script.Serialization;

// Fixed actions only: launch Media Bridge or atomically save a local CSV.
public class DeskNativeHost {
 static JavaScriptSerializer json=new JavaScriptSerializer();
 static string root=AppDomain.CurrentDomain.BaseDirectory;
 static StreamWriter writer;
 static string temporary, target;
 static long chars, expected;
 static int next;
 static byte[] Read(Stream stream,int count){byte[] data=new byte[count];int at=0;while(at<count){int n=stream.Read(data,at,count-at);if(n==0)throw new EndOfStreamException();at+=n;}return data;}
 static string Text(Dictionary<string,object> r,string key){return r.ContainsKey(key)?Convert.ToString(r[key]):"";}
 static string Folder(){string p=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),@"FacebookDesk\Autosave");Directory.CreateDirectory(p);return p;}
 static void Abort(){if(writer!=null){writer.Dispose();writer=null;}if(temporary!=null&&File.Exists(temporary))File.Delete(temporary);temporary=null;}
 static object Handle(Dictionary<string,object> r,string origin){
  string action=Text(r,"action");
  if(action=="start"){
   if(r.Count!=1)throw new Exception("Only fixed start action is supported");
   var p=new ProcessStartInfo(Path.Combine(root,"MediaNativeHost.exe"),"\""+origin+"\"");p.UseShellExecute=false;p.CreateNoWindow=true;p.RedirectStandardInput=true;p.RedirectStandardOutput=true;p.RedirectStandardError=true;
   using(var child=Process.Start(p)){
    byte[] body=Encoding.UTF8.GetBytes("{\"action\":\"start\"}");var stdin=child.StandardInput.BaseStream;stdin.Write(BitConverter.GetBytes(body.Length),0,4);stdin.Write(body,0,body.Length);stdin.Flush();child.StandardInput.Close();
    var stdout=child.StandardOutput.BaseStream;int size=BitConverter.ToInt32(Read(stdout,4),0);if(size<1||size>1048576)throw new Exception("Invalid media host response");return json.DeserializeObject(Encoding.UTF8.GetString(Read(stdout,size)));
   }
  }
  if(action=="start-comments"){
   if(r.Count!=1)throw new Exception("Only fixed comment launcher is supported");
   var launcher=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"));launcher.Arguments="-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+Path.Combine(root,"Start-Comments-Background.ps1")+"\"";launcher.WorkingDirectory=root;launcher.UseShellExecute=true;launcher.WindowStyle=ProcessWindowStyle.Hidden;Process.Start(launcher);return new {ok=true};
  }
  if(action=="comment-config"){
   if(r.Count!=1)throw new Exception("Only fixed coordinator config is supported");
   var config=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),@"FacebookDesk\comments\admin.json")));
   string secret=Convert.ToString(config["adminToken"]);if(secret.Length<32)throw new Exception("Invalid coordinator credential");return new {ok=true,endpoint="http://127.0.0.1:47834/rpc",adminToken=secret};
  }
  if(action=="autosave-info"){return new {ok=true,path=Folder()};}
  if(action=="autosave-open"){string folder=Folder();Process.Start(new ProcessStartInfo("explorer.exe","\""+folder+"\""){UseShellExecute=true});return new {ok=true,path=folder};}
  if(action=="csv-begin"){
   Abort();string profile=Text(r,"profile");if(!Regex.IsMatch(profile,@"^[a-z0-9-]{36}$"))throw new Exception("Invalid profile key");
   string name=Regex.Replace(Text(r,"name").Normalize(),@"[\x00-\x1F<>:""/\\|?*]","_").Trim(' ','.');if(name.Length>90)name=name.Substring(0,90).Trim(' ','.');if(name.Length==0)name="Facebook Desk";
   expected=Convert.ToInt64(r["chars"]);if(expected<0||expected>536870912)throw new Exception("CSV is too large");
   string folder=Folder(),suffix="__"+profile.Replace("-","").Substring(0,16)+"_"+origin.Substring(19,8)+".csv";
   int maxName=Math.Min(90,250-folder.Length-suffix.Length-38);if(maxName<1)throw new Exception("Autosave folder path is too long");if(name.Length>maxName)name=name.Substring(0,maxName).Trim(' ','.');
   target=Path.Combine(folder,name+suffix);
   temporary=target+"."+Guid.NewGuid().ToString("N")+".tmp";writer=new StreamWriter(temporary,false,new UTF8Encoding(false));chars=0;next=0;
   return new {ok=true};
  }
  if(action=="csv-chunk"){
   if(writer==null||Convert.ToInt32(r["index"])!=next)throw new Exception("CSV chunks are out of order");string text=Text(r,"text");if(text.Length>32768||chars+text.Length>expected)throw new Exception("Invalid CSV chunk size");writer.Write(text);chars+=text.Length;next++;return new {ok=true};
  }
  if(action=="csv-commit"){
   if(writer==null||chars!=expected||Convert.ToInt32(r["chunks"])!=next)throw new Exception("CSV is incomplete; previous file was preserved");
   writer.Flush();((FileStream)writer.BaseStream).Flush(true);writer.Dispose();writer=null;
   if(File.Exists(target))File.Replace(temporary,target,target+".previous.csv");else File.Move(temporary,target);temporary=null;
   return new {ok=true,path=target,chars=chars};
  }
  throw new Exception("Unsupported native action");
 }
 public static void Main(string[] args){
  Stream output=Console.OpenStandardOutput(),input=Console.OpenStandardInput();
  try{
   string origin=args.Length>0?args[0]:"";
   if(!Regex.IsMatch(origin,@"^chrome-extension://[a-p]{32}/$"))throw new Exception("Invalid caller origin");
   var manifest=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"media-native-host.json")));bool allowed=false;foreach(object value in (IEnumerable)manifest["allowed_origins"])if(Convert.ToString(value)==origin)allowed=true;
   if(!allowed)throw new Exception("Extension ID is not registered");
   while(true){
    int first=input.ReadByte();if(first<0)break;byte[] length=new byte[4];length[0]=(byte)first;Array.Copy(Read(input,3),0,length,1,3);int count=BitConverter.ToInt32(length,0);if(count<1||count>524288)throw new Exception("Invalid message length");
    object result;
    try{result=Handle(json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Read(input,count))),origin);}catch(Exception error){Abort();result=new {ok=false,error=error.Message};}
    byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(result));output.Write(BitConverter.GetBytes(bytes.Length),0,4);output.Write(bytes,0,bytes.Length);output.Flush();
   }
  }catch(Exception error){byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(new {ok=false,error=error.Message}));try{output.Write(BitConverter.GetBytes(bytes.Length),0,4);output.Write(bytes,0,bytes.Length);output.Flush();}catch{}}
  finally{Abort();}
 }
}
