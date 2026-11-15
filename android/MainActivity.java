package vn.phongthi247.teacher;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.Manifest;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Local teacher tools. Camera requires user consent; file exports use Android SAF. */
public final class MainActivity extends Activity {
  private static final String HOST="appassets.androidplatform.net",BASE="https://"+HOST+"/assets/";
  private WebView web;
  private ValueCallback<Uri[]> chooser;
  private PermissionRequest cameraRequest;
  private boolean resumed=false;
  private byte[] exportBytes;
  private final AtomicBoolean exporting=new AtomicBoolean(false);
  private final Set<String> pages=new HashSet<>(Arrays.asList("index.html","giao-vien.html","soan-de.html","tronde.html","qr.html","cham-bai.html","quet-bai.html"));
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
    layout.setPadding(0,Math.round(28*getResources().getDisplayMetrics().density),0,Math.round(20*getResources().getDisplayMetrics().density));
    LinearLayout bar=new LinearLayout(this);
    Button back=new Button(this);back.setText("Quay lại");back.setOnClickListener(v->leave(false));
    Button home=new Button(this);home.setText("Công cụ");home.setOnClickListener(v->leave(true));
    bar.addView(back);bar.addView(home);layout.addView(bar);
    web=new WebView(this);layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
    WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptCookie(false);web.addJavascriptInterface(new ExportBridge(),"PTWExport");
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){denyPendingCamera();}
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
        Uri u=req.getUrl();String p=u.getPath();
        if(!"https".equals(u.getScheme())||!HOST.equals(u.getHost())||u.getPort()!=-1||p==null||!p.startsWith("/assets/"))return blocked();
        String relative=p.substring(8);
        if(relative.contains("..")||relative.contains("\\")||!(pages.contains(relative)||relative.startsWith("assets/")||relative.startsWith("data/")))return blocked();
        try{String mime=MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(p));
          if(p.endsWith(".js")||p.endsWith(".mjs"))mime="application/javascript";if(p.endsWith(".json"))mime="application/json";if(mime==null)mime="application/octet-stream";
          Map<String,String> headers=new HashMap<>();headers.put("X-Content-Type-Options","nosniff");
          headers.put("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; frame-src 'none'; object-src 'none'; base-uri 'self'");
          return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("www/"+relative));
        }catch(IOException e){return blocked();}
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
        Uri u=req.getUrl();if(req.isForMainFrame()&&"https".equals(u.getScheme())&&HOST.equals(u.getHost())&&u.getPath()!=null&&u.getPath().startsWith("/assets/")&&pages.contains(u.getLastPathSegment()))return false;
        if(req.isForMainFrame()&&req.hasGesture()&&"https".equals(u.getScheme())&&!HOST.equals(u.getHost()))new AlertDialog.Builder(MainActivity.this).setMessage("Mở liên kết bằng trình duyệt ngoài?").setPositiveButton("Mở",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(ActivityNotFoundException e){message("Không có trình duyệt phù hợp.");}}).setNegativeButton("Hủy",null).show();
        return true;
      }
      @Override public void onPageFinished(WebView view,String url){if(url.startsWith(BASE))try{InputStream in=getAssets().open("native-downloads.js");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);in.close();view.evaluateJavascript(out.toString("UTF-8"),null);}catch(IOException e){message("Không khởi tạo được xuất tệp.");}}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
        Uri origin=request.getOrigin();String[] resources=request.getResources();
        boolean trusted="https".equals(origin.getScheme())&&HOST.equals(origin.getHost())&&origin.getPort()==-1;
        boolean cameraOnly=resources.length==1&&PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resources[0]);
        if(!trusted||!cameraOnly||!isScannerPage()||!resumed||isFinishing()){request.deny();return;}
        denyPendingCamera();
        if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        else{cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},20);}
      });}
      @Override public void onPermissionRequestCanceled(PermissionRequest request){runOnUiThread(()->{if(cameraRequest==request)cameraRequest=null;});}
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams params){
        if(chooser!=null)chooser.onReceiveValue(null);chooser=cb;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("*/*");
        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
        String[] accepted=params.getAcceptTypes();if(accepted!=null&&accepted.length>0&&Arrays.stream(accepted).allMatch(t->t.startsWith("image/"))){pick.setType("image/*");pick.putExtra(Intent.EXTRA_MIME_TYPES,accepted);}
        try{startActivityForResult(pick,10);}catch(ActivityNotFoundException e){chooser.onReceiveValue(null);chooser=null;message("Không có trình chọn tệp.");}return true;
      }
      @Override public boolean onJsAlert(WebView v,String url,String msg,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("Đóng",(d,w)->r.confirm()).setOnCancelListener(d->r.cancel()).show();return true;}
      @Override public boolean onJsConfirm(WebView v,String url,String msg,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("Tiếp tục",(d,w)->r.confirm()).setNegativeButton("Hủy",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).show();return true;}
      @Override public boolean onJsBeforeUnload(WebView v,String url,String msg,JsResult r){AlertDialog dialog=new AlertDialog.Builder(MainActivity.this).setMessage("Trang có dữ liệu chưa xuất. Rời trang có thể mất dữ liệu.").setPositiveButton("Rời trang",(d,w)->r.confirm()).setNegativeButton("Ở lại",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).create();dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_NEGATIVE).requestFocus());dialog.show();return true;}
    });
    web.loadUrl(BASE+"index.html");
  }
  private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
  private void denyPendingCamera(){if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}}
  private boolean isScannerPage(){if(web==null||web.getUrl()==null)return false;Uri u=Uri.parse(web.getUrl());return "https".equals(u.getScheme())&&HOST.equals(u.getHost())&&u.getPort()==-1&&"/assets/quet-bai.html".equals(u.getPath());}
  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
    super.onRequestPermissionsResult(requestCode,permissions,results);
    if(requestCode==20&&cameraRequest!=null){PermissionRequest pending=cameraRequest;cameraRequest=null;
      if(results.length==1&&results[0]==PackageManager.PERMISSION_GRANTED&&!isFinishing()&&isScannerPage())pending.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else pending.deny();}
  }
  @Override protected void onResume(){super.onResume();resumed=true;}
  @Override protected void onPause(){resumed=false;if(web!=null&&cameraRequest==null)web.evaluateJavascript("window.dispatchEvent(new Event('ptw-app-hidden'))",null);super.onPause();}
  @Override protected void onStop(){denyPendingCamera();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('ptw-app-hidden'))",null);super.onStop();}
  private void message(String m){runOnUiThread(()->Toast.makeText(this,m,Toast.LENGTH_LONG).show());}
  private void leave(boolean home){new AlertDialog.Builder(this).setMessage("Dữ liệu chưa xuất có thể mất khi rời trang. Đã lưu tệp cần giữ?").setPositiveButton("Rời trang",(d,w)->{if(home)web.loadUrl(BASE+"index.html");else if(web.canGoBack())web.goBack();else finish();}).setNegativeButton("Ở lại",null).show();}
  @Override public void onBackPressed(){leave(false);}
  public final class ExportBridge {
    @JavascriptInterface public void save(String name,String mime,String data){
      if(data==null||data.length()>34*1024*1024||!exporting.compareAndSet(false,true)){message("Đang có tệp chờ lưu hoặc tệp quá lớn (24 MB).");return;}
      try{byte[] decoded=Base64.decode(data,Base64.DEFAULT);if(decoded.length>24*1024*1024)throw new IllegalArgumentException();exportBytes=decoded;
        String safe=(name==null?"export":name).replaceAll("[^\\p{L}\\p{N}._ -]","_");if(safe.length()>140)safe=safe.substring(safe.length()-140);
        final String filename=safe;final String type=mime!=null&&mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")?mime:"application/octet-stream";
        runOnUiThread(()->{if(web.getUrl()==null||!web.getUrl().startsWith(BASE)){clearExport();return;}Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(type);save.putExtra(Intent.EXTRA_TITLE,filename);try{startActivityForResult(save,11);}catch(ActivityNotFoundException e){clearExport();message("Không có trình lưu tệp.");}});
      }catch(IllegalArgumentException e){clearExport();message("Dữ liệu xuất không hợp lệ.");}
    }
    @JavascriptInterface public void printPage(){runOnUiThread(()->{if(web.getUrl()!=null&&web.getUrl().startsWith(BASE)){
      final String printUrl=web.getUrl();final PrintDocumentAdapter delegate=web.createPrintDocumentAdapter("PhongThi247");
      PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
        @Override public void onStart(){delegate.onStart();}
        @Override public void onLayout(PrintAttributes oldAttrs,PrintAttributes newAttrs,CancellationSignal signal,LayoutResultCallback callback,Bundle extras){delegate.onLayout(oldAttrs,newAttrs,signal,callback,extras);}
        @Override public void onWrite(PageRange[] ranges,ParcelFileDescriptor destination,CancellationSignal signal,WriteResultCallback callback){delegate.onWrite(ranges,destination,signal,callback);}
        @Override public void onFinish(){try{delegate.onFinish();}finally{if(!isFinishing()&&printUrl.equals(web.getUrl()))web.evaluateJavascript("window.dispatchEvent(new Event('afterprint'))",null);}}
      };
      try{PrintManager pm=(PrintManager)getSystemService(PRINT_SERVICE);pm.print("PhongThi247",adapter,null);}catch(RuntimeException e){web.evaluateJavascript("window.dispatchEvent(new Event('afterprint'))",null);message("Không mở được dịch vụ in.");}
    }});}
  }
  private void clearExport(){exportBytes=null;exporting.set(false);}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
    if(request==10&&chooser!=null){ArrayList<Uri> selected=new ArrayList<>();if(result==RESULT_OK&&data!=null){ClipData clips=data.getClipData();if(clips!=null){for(int i=0;i<Math.min(clips.getItemCount(),100);i++){Uri u=clips.getItemAt(i).getUri();if(u!=null&&"content".equals(u.getScheme()))selected.add(u);}}else{Uri u=data.getData();if(u!=null&&"content".equals(u.getScheme()))selected.add(u);}}chooser.onReceiveValue(selected.isEmpty()?null:selected.toArray(new Uri[0]));chooser=null;}
    if(request==11){if(result==RESULT_OK&&data!=null&&data.getData()!=null&&"content".equals(data.getData().getScheme())&&exportBytes!=null){
      final Uri destination=data.getData();final byte[] bytes=exportBytes;
      new Thread(()->{try(OutputStream stream=getContentResolver().openOutputStream(destination,"w")){if(stream==null)throw new IOException();stream.write(bytes);message("Đã lưu tệp.");}catch(IOException|SecurityException e){message("Không lưu được tệp. Hãy thử lại ở thư mục khác.");}finally{clearExport();}},"PTW-export").start();
    }else{message("Đã hủy lưu. Dữ liệu vẫn ở trang hiện tại.");clearExport();}}
  }
  @Override protected void onDestroy(){denyPendingCamera();if(chooser!=null)chooser.onReceiveValue(null);clearExport();web.removeJavascriptInterface("PTWExport");web.destroy();super.onDestroy();}
}
