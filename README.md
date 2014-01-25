这个项目使用了foobar2000的插件 [foo\_mg](https://github.com/oxyflour/foo_mg) 提供的功能

##主要功能
###foobar2000媒体库浏览
基于 foo\_mg 提供的数据库（mgdatabase.dat)，browse.lua 提供了一个简单的web界面，用于浏览和播放foobar2000中的媒体文件。该脚本同时还会扫描整合和媒体文件在同一文件夹下的图片、文本等资源。

###foobar2000媒体串流
track.lua 提供直接传送媒体文件或者将其转换为 wav 或 mp3 进行串流的服务，可以根据不同的客户端自动判断所支持的格式

###资源的传送和转换
对于唱片中的booklet等图片资源，以及文本、歌词等资源，可以先经过尺寸或编码的转换再发送给客户端（resource.lua）

###媒体库搜索
就是简单的数据库内搜索而已（通过search.lua）

###支持现代浏览器的Web App
由于 browse.lua 和 search.lua 可以以json的格式输出数据，以此为基础开发了一个简陋的web app，用于整合上面的功能。这个app支持桌面和移动端的大部分现代浏览器（主要在 webkit 和 ie 上测试）

可以在 screenshots 文件夹下看到部分截图


##如何安装
首先你需要在foobar2000中安装 [foo\_mg](https://github.com/oxyflour/foo_mg)，然后将本项目中的所有文件放置到设定的目录里（默认是foobar2000目录下的www文件夹）。如果没有改过默认端口（8080），那在浏览器中打开 http://127.0.0.1:8080/ 即可


##许可证
可以不要吗？
