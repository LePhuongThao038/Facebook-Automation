using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

public class MediaNativeHost {
    static JavaScriptSerializer json = new JavaScriptSerializer();
    static string root = AppDomain.CurrentDomain.BaseDirectory;
    static byte[] ReadExact(Stream stream, int count) {
        byte[] bytes = new byte[count]; int offset=0;
        while(offset<count) { int n=stream.Read(bytes,offset,count-offset); if(n==0) throw new Exception("Incomplete message"); offset+=n; }
        return bytes;
    }
    static IEnumerable<string> Strings(object value) {
        var list=value as IEnumerable;
        if(list==null || value is string) return new string[0];
        return list.Cast<object>().Select(v=>Convert.ToString(v));
    }
    public static void Main(string[] args) {
        object result;
        try {
            string origin=args.Length>0 ? args[0] : "";
            if(!Regex.IsMatch(origin,@"^chrome-extension://[a-p]{32}/$")) throw new Exception("Invalid caller origin");
            var manifest=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"media-native-host.json")));
            if(!Strings(manifest["allowed_origins"]).Contains(origin)) throw new Exception("Extension ID is not registered. Run Install-Start-Video.cmd with this ID.");
            Stream input=Console.OpenStandardInput();
            int size=BitConverter.ToInt32(ReadExact(input,4),0);
            if(size<1 || size>65536) throw new Exception("Invalid message size");
            var request=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ReadExact(input,size)));
            if(request.Count!=1 || !request.ContainsKey("action") || Convert.ToString(request["action"])!="start") throw new Exception("Only start is supported");
            using(var mutex=new Mutex(false,@"Local\FacebookDeskMediaConfig")) {
                bool owned=false;
                try {
                    try { owned=mutex.WaitOne(10000); } catch(AbandonedMutexException) { owned=true; }
                    if(!owned) throw new Exception("Media setup is busy. Try again.");
                    string configPath=Path.Combine(root,"media-bridge-config.json");
                    var config=File.Exists(configPath) ? json.Deserialize<Dictionary<string,object>>(File.ReadAllText(configPath)) : new Dictionary<string,object>();
                    var ids=config.ContainsKey("extensionIds") ? Strings(config["extensionIds"]).ToList() : new List<string>();
                    ids.Add(origin.Substring(19,32));
                    config["extensionIds"]=ids.Where(id=>Regex.IsMatch(id,@"^[a-p]{32}$")).Distinct().ToArray();
                    string temp=configPath+".native.tmp";
                    File.WriteAllText(temp,json.Serialize(config),new UTF8Encoding(false));
                    if(File.Exists(configPath)) File.Replace(temp,configPath,null); else File.Move(temp,configPath);
                } finally { if(owned) mutex.ReleaseMutex(); }
            }
            string launcher=Path.Combine(root,"Start-Media-Background.ps1");
            if(!File.Exists(launcher)) throw new Exception("Missing background launcher");
            var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"));
            info.Arguments="-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+launcher+"\"";
            // Shell launch avoids passing Chrome's native-message pipe handles
            // into the long-running bridge. The console remains hidden.
            info.WorkingDirectory=root; info.UseShellExecute=true; info.WindowStyle=ProcessWindowStyle.Hidden;
            Process.Start(info);
            result=new {ok=true, launched=true};
        } catch(Exception error) { result=new {ok=false,error=error.Message}; }
        byte[] output=Encoding.UTF8.GetBytes(json.Serialize(result));
        Stream stdout=Console.OpenStandardOutput(); stdout.Write(BitConverter.GetBytes(output.Length),0,4); stdout.Write(output,0,output.Length); stdout.Flush();
    }
}
