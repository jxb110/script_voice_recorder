export function fileManagerHtmlPage() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>采音脚本 · 文件管理</title>
  <style>
    :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#1b2438;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:920px;margin:auto;padding:28px 18px}h1{font-size:27px;margin:0}.sub{color:#65708a;line-height:1.65;margin:7px 0 0}.card{background:#fff;border:1px solid #e1e7f0;border-radius:16px;margin-top:16px;overflow:hidden}.toolbar{align-items:center;background:#f8faff;border-bottom:1px solid #e8edf5;display:flex;flex-wrap:wrap;gap:9px;padding:12px;transition:background .15s,border .15s}.toolbar.dragging{background:#e7efff;box-shadow:inset 0 0 0 2px #2f4da0}.drop-hint{color:#66799c;font-size:12px;font-weight:700;order:5;width:100%}.path{color:#355394;flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;min-width:190px;overflow-wrap:anywhere}.btn{border:0;background:#2f4da0;color:#fff;border-radius:9px;cursor:pointer;font-weight:700;padding:9px 12px}.btn.alt{background:#edf2ff;color:#2f4da0}.file-list{min-height:180px}.row{align-items:center;border-top:1px solid #eef1f6;display:flex;gap:11px;padding:11px 14px}.row:first-child{border-top:0}.row .icon{color:#2f4da0}.row .name{cursor:pointer;flex:1;font-weight:700;overflow-wrap:anywhere}.row .meta{color:#7b879e;font-size:12px}.actions{display:flex;gap:7px}.small{border:0;border-radius:8px;cursor:pointer;font-weight:700;padding:7px 9px}.download{background:#e8f7ef;color:#18754f}.delete{background:#fff0f1;color:#bd4050}.empty{color:#71809b;padding:28px;text-align:center}.muted{color:#65708a}.notice{align-items:flex-start;background:#fff8e8;border-radius:13px;color:#705c2b;display:flex;gap:8px;margin-top:14px;padding:13px}.tag{background:#e8f7ef;border-radius:999px;color:#19764f;font-size:12px;font-weight:800;padding:4px 9px}input[type=file]{display:none}#message{color:#2f4da0;min-height:20px;margin:12px 14px 14px}@media(max-width:560px){.wrap{padding:18px 12px}.actions{flex-wrap:wrap}.row{align-items:flex-start}.toolbar{align-items:stretch}.path{min-width:100%}}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>采音脚本 · 文件管理</h1>
    <p class="sub">默认打开录音导出目录 <span class="tag">record_jxb/wave</span>。本页仅在同一 Wi‑Fi 下可用，并且仅在手机应用保持前台时有效。</p>
    <div class="notice">地址包含完整读写权限。请仅发送给可信设备；不要在公共网络使用。</div>
    <section class="card">
      <div id="drop-zone" class="toolbar">
        <button id="up" class="btn alt">上级目录</button>
        <span id="path" class="path">正在读取目录…</span>
        <button id="mkdir" class="btn alt">新建目录</button>
        <label class="btn" for="files">上传文件</label><input id="files" type="file" multiple><span class="drop-hint">可将多个文件直接拖入此区域上传</span>
      </div>
      <div id="list" class="file-list"></div><div id="message"></div>
    </section>
  </main>
  <script>
  (function(){
    var token=new URLSearchParams(location.search).get('token')||'';
    var current='record_jxb/wave';
    var list=document.getElementById('list');
    var pathLabel=document.getElementById('path');
    var message=document.getElementById('message');
    var filesInput=document.getElementById('files');
    var dropZone=document.getElementById('drop-zone');
    function esc(value){return String(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]})}
    function api(path,options){var glue=path.indexOf('?')>-1?'&':'?';return fetch(path+glue+'token='+encodeURIComponent(token),options)}
    function sizeText(value){return value<1024?value+' B':value<1048576?(value/1024).toFixed(1)+' KB':(value/1048576).toFixed(1)+' MB'}
    function parent(path){return path.indexOf('/')>-1?path.slice(0,path.lastIndexOf('/')):''}
    function showError(error){var text=(error&&error.message)||String(error)||'操作失败';message.textContent=text;return text}
    function encodedPath(element){return decodeURIComponent(element.getAttribute('data-path')||'')}
    async function refresh(){
      message.textContent='';pathLabel.textContent='/storage/emulated/0/'+current;list.innerHTML='<div class="empty">正在读取目录…</div>';
      try{
        var response=await api('/api/fs/list?path='+encodeURIComponent(current));
        var data=await response.json();
        if(!response.ok)throw Error(data.error||'无法读取目录');
        if(!data.entries.length){list.innerHTML='<div class="empty">此目录为空。</div>';return}
        list.innerHTML=data.entries.map(function(entry){
          var encoded=encodeURIComponent(entry.relativePath);
          var open=entry.isDirectory?'<span class="name" data-open="1" data-path="'+encoded+'">'+esc(entry.name)+'</span>':'<span class="name">'+esc(entry.name)+'</span>';
          var download=entry.isDirectory?'':'<button class="small download" data-download="1" data-path="'+encoded+'">下载</button>';
          var folderDownload=entry.isDirectory?'<button class="small download" data-download-folder="1" data-path="'+encoded+'">下载文件夹</button>':'';
          return '<div class="row"><span class="icon">'+(entry.isDirectory?'📁':'📄')+'</span>'+open+'<span class="meta">'+(entry.isDirectory?'目录':sizeText(entry.size))+'</span><span class="actions">'+download+folderDownload+'<button class="small delete" data-delete="1" data-path="'+encoded+'">删除</button></span></div>';
        }).join('');
      }catch(error){list.innerHTML='<div class="empty">'+esc(showError(error))+'</div>'}
    }
    async function requestJson(path,options){var response=await api(path,options);var data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data}
    async function createFolder(){var name=prompt('新目录名称');if(!name)return;try{await requestJson('/api/fs/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:current,name:name})});await refresh()}catch(error){showError(error)}}
    async function removeEntry(path){if(!confirm('确定删除“'+path.split('/').pop()+'”吗？此操作不可恢复。'))return;try{await requestJson('/api/fs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path})});await refresh()}catch(error){showError(error)}}
    async function downloadEntry(path){message.textContent='正在准备下载…';try{var data=await requestJson('/api/fs/download?path='+encodeURIComponent(path));var raw=atob(data.base64);var output=new Uint8Array(raw.length);for(var index=0;index<raw.length;index++)output[index]=raw.charCodeAt(index);var link=document.createElement('a');link.href=URL.createObjectURL(new Blob([output],{type:'application/octet-stream'}));link.download=data.name;link.click();URL.revokeObjectURL(link.href);message.textContent='下载已开始。'}catch(error){showError(error)}}
    function downloadFolder(path){message.textContent='正在准备文件夹下载…';var link=document.createElement('a');link.href='/api/fs/download-folder?path='+encodeURIComponent(path)+'&token='+encodeURIComponent(token);link.download='';link.click();message.textContent='文件夹下载已开始。'}
    function toBase64(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onerror=function(){reject(Error('读取文件失败'))};reader.onload=function(){resolve(String(reader.result).split(',')[1]||'')};reader.readAsDataURL(file)})}
    async function upload(files){var selected=Array.prototype.slice.call(files);var succeeded=0;for(var index=0;index<selected.length;index++){var file=selected[index];if(file.size>15728640){message.textContent='上传 '+(index+1)+'/'+selected.length+'：'+file.name+' 超过 15 MB 限制。';continue}try{message.textContent='正在上传 '+(index+1)+'/'+selected.length+'：'+file.name;await requestJson('/api/fs/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:current,name:file.name,base64:await toBase64(file)})});succeeded++}catch(error){showError(error)}}message.textContent='已完成 '+succeeded+'/'+selected.length+' 个文件上传。';await refresh()}
    document.getElementById('up').addEventListener('click',function(){current=parent(current);refresh()});
    document.getElementById('mkdir').addEventListener('click',createFolder);
    list.addEventListener('click',function(event){var target=event.target.closest('[data-open],[data-download],[data-download-folder],[data-delete]');if(!target)return;var path=encodedPath(target);if(target.hasAttribute('data-open')){current=path;refresh()}else if(target.hasAttribute('data-download')){downloadEntry(path)}else if(target.hasAttribute('data-download-folder')){downloadFolder(path)}else{removeEntry(path)}});
    filesInput.addEventListener('change',function(){if(filesInput.files)upload(filesInput.files);filesInput.value=''});
    ['dragenter','dragover'].forEach(function(eventName){dropZone.addEventListener(eventName,function(event){event.preventDefault();dropZone.classList.add('dragging')})});
    ['dragleave','drop'].forEach(function(eventName){dropZone.addEventListener(eventName,function(event){event.preventDefault();dropZone.classList.remove('dragging')})});
    dropZone.addEventListener('drop',function(event){var files=event.dataTransfer&&event.dataTransfer.files;if(files&&files.length)upload(files)});
    document.addEventListener('dragover',function(event){event.preventDefault()});
    document.addEventListener('drop',function(event){event.preventDefault()});
    window.onerror=function(_message,_source,_line,_column,error){showError(error||Error('页面脚本异常'))};
    refresh();
  }());
  </script>
</body>
</html>`;
}
