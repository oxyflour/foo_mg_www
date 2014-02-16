这个项目使用了foobar2000的插件 [foo\_mg](https://github.com/oxyflour/foo_mg) 提供的功能

##主要功能
###foobar2000媒体库浏览
基于 foo\_mg 提供的数据库（mgdatabase.db3)，提供了一个简单的web界面，用于浏览和播放foobar2000中的媒体文件。该脚本同时还会扫描和媒体文件在同一文件夹下的图片、文本等资源。
url: lua/browse.lua?path={string}&sort={string,opt}&begin={int,opt}&count={int,opt}

###媒体库搜索
就是简单的数据库内搜索而已
url(return items from trackids or folderids): lua/browse.lua?tlist={string,opt}&flist={string,opt}
url(search string): lua/browse.lua?word={string}&fields={string}&sort={string,opt}&begin={int,opt}&count={int,opt}

###foobar2000媒体串流
提供直接传送媒体文件或者将其转换为 wav 或 mp3 进行串流的服务，可以根据不同的客户端自动判断所支持的格式
url: lua/resource.lua?id={int}&support={string,opt}

###资源的传送和转换
对于唱片中的booklet等图片资源，以及文本、歌词等，可以先经过尺寸或编码的转换再发送给客户端
返回的所有文本都会是unicode（utf-8，utf-16）
url(albumart of a track): lua/resource.lua?res=albumart&id={int}&size={int,opt}
url(lyric of a track): lua/resource.lua?res=lyric&id={int}
url(booklet or text under a path): lua/resource.lua?res={string}&path={string}

###支持现代浏览器的Web App
browse.lua 可以以json的格式输出数据，以此为基础开发了一个简陋的web app，用于整合上面的功能。这个app支持桌面和移动端的大部分现代浏览器（桌面版主要在最新版 Chrome 和 IE 上测试，移动版则使用 Android 4.2 上的 WebView，Chrome 和 Firefox）

可以在 screenshots 文件夹下看到部分截图


##如何安装
首先你需要在foobar2000中安装 [foo\_mg](https://github.com/oxyflour/foo_mg)，然后将本项目中的所有文件放置到设定的目录里（默认是foobar2000目录下的foo\_mg\_www文件夹）。如果没有改过默认端口（8080），那在浏览器中打开 http://127.0.0.1:8080/ 即可
如果你想生成封面的缩略图以提高访问速度，请在foo\_mg\_www下新建tmp\cache文件夹，并下载[ImageMagic](http://www.imagemagick.org/script/download.php)软件包中的convert.exe程序放在tmp\ImageMagic文件夹下


##许可证
可以不要吗？
