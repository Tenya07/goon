/* Reviewed course relationships. Visibility is gated by the user's lecture progress.
   Notes are never treated as an exhaustive syllabus or as proof of mastery. */
const NotebookKnowledge = (() => {
  const nodes = [], edges = [];
  const T = 'y1-cs50t', P = 'y1-cs50p';
  const ref = (course, index, anchor = '') => ({course, index,
    url: course === T ? `https://cs50.harvard.edu/technology/notes/${index + 1}/${anchor}` : `https://cs50.harvard.edu/python/notes/${index}/${anchor}`});
  function n(id, title, group, course, index, description, aliases = [], anchor = '') {
    nodes.push({id, title, group, description, aliases:[title, ...aliases], refs:[ref(course,index,anchor)]});
  }
  function e(from, to, label, explanation, course, index, anchor = '') {
    edges.push({id:`${from}--${to}`, from, to, label, explanation, refs:[ref(course,index,anchor)]});
  }
  n('binary','二进制','hardware',T,0,'用 0 和 1 表示数据。位的位置对应 2 的幂。',['binary','二进制'],'#binary');
  n('encoding','文字编码','hardware',T,0,'ASCII 等约定文字与数字的对应关系；文字最终以位保存。',['ASCII','编码']);
  n('cpu','CPU','hardware',T,0,'执行指令的处理器。主频和核心数只是影响性能的部分因素。',['处理器']);
  n('ram','内存 RAM','hardware',T,0,'暂存程序正在使用的数据；普通 RAM 断电后不保留内容。',['RAM','内存']);
  n('storage','硬盘与 SSD','hardware',T,0,'长期保存程序和文件，区别于运行时使用的内存。',['SSD','硬盘','HDD']);
  n('os','操作系统','hardware',T,0,'管理硬件资源，给应用提供运行环境。',['操作系统','operating system']);
  n('ip','IP 地址','network',T,1,'网络接口的地址，用于在 IP 网络中寻址。内网地址不等于可以从公网直接访问。',['IP','IP地址'],'#ip');
  n('domain','域名','network',T,1,'便于人记忆的名称，例如 example.com；它不是 URL 的全部。',['域名','domain'],'#dns');
  n('dns','DNS','network',T,1,'查询域名对应的记录，例如 IP 地址。缓存可让某次访问不必重新发起 DNS 查询。',['DNS'],'#dns');
  n('packet','数据包','network',T,1,'网络传递数据时使用的单位；一个资源可能需要多个包传输。',['packet','数据包'],'#packets');
  n('router','路由器','network',T,1,'根据目的 IP 等路由信息，把包转发到下一跳。',['router','路由器']);
  n('tcp','TCP','network',T,1,'提供可靠、有序的字节流；不等同于 HTTP，也不是所有网络应用都使用它。',['TCP'],'#tcpip');
  n('udp','UDP','network',T,1,'提供数据报传输，本身不保证送达或顺序；应用可以自行增加所需机制。',['UDP'],'#udp');
  n('dhcp','DHCP','network',T,1,'向设备提供 IP 地址等网络配置；与 DNS 查询域名的职责不同。',['DHCP'],'#ip');
  n('port','端口','network',T,1,'TCP、UDP 等传输协议用端口区分通信端点。IP 与端口的职责不同。',['port','端口']);
  n('http','HTTP','web',T,4,'浏览器和服务器交换请求与响应的应用层协议。',['HTTP','请求','响应'],'#http');
  nodes.find(x=>x.id==='http').refs.push(ref(T,1));
  n('https','HTTPS','security',T,3,'受 TLS 保护的 HTTP。保护传输，并不保证网站内容或运营者可信。',['HTTPS'],'#encryption');
  n('browser','浏览器','web',T,4,'请求资源，并解释 HTML、CSS 等来显示页面。',['浏览器','browser'],'#web-browser');
  n('server','Web 服务器','web',T,4,'接收请求并返回响应；服务器程序运行在有处理器、内存和存储的计算机上。',['服务器','server'],'#web-server');
  n('url','URL','web',T,4,'资源地址，可包含协议、主机、端口、路径和查询参数。主机可以是域名，也可以是 IP。',['URL','网址'],'#web-browser');
  n('html','HTML','web',T,4,'描述页面结构的标记语言；不是负责传输的协议。',['HTML','html'],'#html');
  n('tags','HTML 标签','web',T,4,'例如 head、body、p、table。用元素表达文档的结构与内容。',['<head>','<body>','<p>','<table>','<tr>','<td>','<ul>','<ol>','<li>'],'#html');
  n('link','链接 a / href','web',T,4,'a 元素定义超链接，href 给出目标地址；可以使用相对或绝对 URL。',['href','<a ','<a>'],'#links');
  n('form','表单 form','web',T,4,'收集输入，并按 action 和 method 向目标提交。',['<form','action=','method='],'#forms');
  n('get','GET','web',T,4,'HTTP 请求方法之一。HTML GET 表单会把成功控件的数据编码到 URL 的查询部分。',['method="get"','method=\'get\'','GET'],'#forms');
  n('css','CSS','web',T,4,'样式表语言，描述文档如何呈现。外部样式表可以通过 link 元素引用。',['CSS','style.css','stylesheet'],'#css');
  n('javascript','JavaScript','web',T,4,'编程语言，可以在浏览器里为网页添加交互；不是 Java。',['JavaScript'],'#javascript');
  n('headers','HTTP 响应头','web',T,4,'响应中的元信息，如状态和内容类型；与 HTML 正文不同。',['响应头','curl -I'],'#http');
  n('curl','curl','web',T,4,'命令行 HTTP 等协议客户端。curl -I 通常发送 HEAD 请求来获取响应头。',['curl'],'#http');
  n('pixels','像素与 RGB','media',T,2,'图像由像素构成；RGB 用红、绿、蓝分量表示颜色。',['像素','RGB','pixel'],'#rgb');
  n('image','图像文件','media',T,2,'JPEG、PNG、GIF 等格式用不同方式组织图像数据。',['JPEG','PNG','GIF'],'#graphics');
  n('compression','压缩','media',T,2,'用更少的位表示数据。有损压缩丢弃部分信息，无损压缩可恢复原始数据。',['压缩','有损','无损']);
  n('audio','数字音频','media',T,2,'把声音转为数字数据；采样率和位深描述采样的不同方面。',['声音','音频','采样率','位深'],'#audio');
  n('mp3','MP3','media',T,2,'通常采用有损音频压缩，以较小文件体积交换部分音频信息。',['MP3'],'#audio');
  n('wav','WAV','media',T,2,'音频容器格式，常见内容是未压缩 PCM；不能把所有 WAV 都等同于未压缩数据。',['WAV'],'#audio');
  n('midi','MIDI','media',T,2,'记录演奏事件等音乐指令，不是麦克风录下的声音波形。',['MIDI'],'#audio');
  n('video','视频','media',T,2,'由连续画面构成，通常还包含声音；帧率与分辨率影响体验和数据量。',['视频','帧率']);
  n('encryption','加密','security',T,3,'利用密钥把明文变成密文，保护数据机密性；不等于身份验证。',['加密','encryption'],'#encryption');
  n('cookie','Cookie','security',T,3,'浏览器保存并按规则随请求发送的小段数据，可用于维持登录状态。',['cookie','Cookie'],'#cookies');
  n('password','密码','security',T,3,'用于身份验证的秘密；长度、不可预测性和避免重复使用很重要。',['密码','password']);
  n('twofactor','双因素验证','security',T,3,'组合不同类型的验证因素；两个密码并不自动构成双因素。',['2FA','双因素','两步验证'],'#two-factor-authentication');
  n('manager','密码管理器','security',T,3,'帮助生成和保管不同账号的独立密码，仍需要妥善保护主密码等解锁方式。',['密码管理器'],'#password-managers');
  n('vpn','VPN','security',T,3,'在设备与 VPN 对端之间建立隧道；不意味着从对端到所有网站的连接也被它端到端保护。',['VPN'],'#vpn');
  n('firewall','防火墙','security',T,3,'按网络规则允许或阻止流量；不等于加密，也不保证绝对安全。',['防火墙','firewall'],'#firewall');
  n('variable','变量','python',P,0,'把名称绑定到值，便于在程序中再次使用。',['变量','variable']);
  n('function','函数','python',P,0,'可调用的代码单元，能够接收参数，也可能返回值。',['函数','function','def ']);
  n('string','字符串 str','python',P,0,'表示文本的数据类型；input() 返回字符串。',['str','字符串','input(']);
  n('number','数值 int / float','python',P,0,'int 表示整数，float 表示浮点数。用户输入的文本通常需要转换后再运算。',['int(','float(','整数','浮点']);
  n('return','return','python',P,0,'结束当前函数调用，并把值交给调用者；不同于 print 在屏幕上输出。',['return']);
  n('condition','条件判断','python',P,1,'根据条件选择执行分支，例如 if、elif、else。',['if ','elif','else','条件']);
  n('boolean','布尔值 bool','python',P,1,'True 和 False。比较表达式通常产生布尔值。',['bool','True','False','布尔']);
  n('loop','循环','python',P,2,'重复执行代码，例如 for、while；循环内部也可以调用函数。',['for ','while','循环']);
  n('list','列表 list','python',P,2,'有顺序的可变容器；索引通常从 0 开始。',['list','列表']);
  n('dict','字典 dict','python',P,2,'通过键访问值的映射；不等于 JSON 文本。',['dict','字典']);
  n('exception','异常','python',P,3,'程序运行中报告异常情况的机制，如 ValueError。',['Exception','ValueError','异常']);
  n('try','try / except','python',P,3,'捕获指定异常，以便处理失败或重新请求输入。',['try:','except']);
  n('library','库 library','python',P,4,'可复用代码的统称，可以由自己或他人编写。Python 有自带的标准库，也可安装第三方库；library 不是 Python 独有的概念。',['library','libraries','liblary','库'],'#libraries');
  n('module','模块与 import','python',P,4,'模块组织可复用的代码，import 是导入模块或其中名称的语句。库是较宽泛的称呼，模块与包是组织代码的方式，不是三个完全同级的东西。',['import ','模块'],'#libraries');
  n('random','random','python',P,4,'标准库模块，提供 choice、randint 等伪随机操作。',['random','randint','choice'],'#random');
  n('argv','sys.argv','python',P,4,'命令行参数列表。第 0 项通常是脚本名，其余项通常是文本参数。',['sys.argv','argv'],'#command-line-arguments');
  n('package','包与 pip','python',P,4,'第三方包可以用 pip 安装；安装和在代码中 import 是不同操作。',['pip','PyPI','package','cowsay'],'#packages');
  n('api','API','python',P,4,'软件之间约定的调用接口。课程以 HTTP API 为例，但 API 不限于网络接口。',['API'],'#apis');
  n('requests','requests','python',P,4,'Python 的第三方 HTTP 客户端包，可以发送请求并读取响应。',['requests'],'#apis');
  n('json','JSON','python',P,4,'交换数据的文本格式。解析后才变成 Python 的字典、列表等对象。',['JSON','json'],'#apis');
  e('binary','encoding','用于表示','字符先按编码约定对应数字，数字再以位表示。',T,0);
  e('os','cpu','管理资源','操作系统调度处理器资源供程序使用；这不是先后执行的流程线。',T,0);
  e('os','ram','管理资源','操作系统管理内存资源；程序运行时会使用内存。',T,0);
  e('os','storage','管理文件存储','操作系统通过文件系统等机制管理持久化存储。',T,0);
  e('domain','dns','查询名称','需要名称解析时，域名可以作为 DNS 查询的对象。已有缓存时不一定再发出网络查询。',T,1);
  e('dns','ip','可解析为','DNS 的 A / AAAA 记录给出 IP 地址；DNS 也有其他类型的记录。',T,1);
  e('router','packet','转发','路由器根据目的地址等信息把 IP 包送往下一跳，不负责解释 HTML。',T,1);
  e('packet','ip','携带寻址信息','IP 包头中包含源 IP、目的 IP 等信息。',T,1);
  e('tcp','port','使用端口','TCP 通信端点使用端口号，帮助区分连接；UDP 也有端口。',T,1);
  e('tcp','packet','借助 IP 包传输','TCP 数据通过 IP 网络传递；TCP 与 IP 的职责并不相同。',T,1);
  e('udp','port','也使用端口','UDP 和 TCP 都有端口，但它们是不同的传输协议。',T,1);
  e('dhcp','ip','可分配地址','DHCP 可分配 IP 地址并提供网关、DNS 服务器等配置；不是把网址翻译成 IP。',T,1);
  e('browser','url','访问资源地址','浏览器根据 URL 请求或打开资源；不是所有 URL 都要经过 DNS。',T,4);
  e('url','domain','主机可以是','URL 的主机部分可以是域名，也可以直接是 IP；因此这不是“必须依赖域名”。',T,4);
  e('browser','http','发送请求','浏览器通过 HTTP 请求资源，也接收 HTTP 响应。',T,4);
  e('http','server','请求 / 响应','客户端发请求，服务器返回响应；箭头表示协议交互对象，不代表只有单向通信。',T,4);
  e('http','tcp','课堂示例使用','课堂展示的 HTTP/1.1 使用 TCP 传输；不能推广为所有 HTTP 版本都必须使用 TCP。',T,4);
  e('server','cpu','运行所需硬件','服务器程序运行在计算机上，会使用 CPU 执行指令。',T,4);
  e('server','ram','运行所需内存','服务器运行时使用内存；服务器不是脱离硬件独立存在的网络名词。',T,4);
  e('server','html','可以返回','HTML 可以是响应正文；服务器也可以返回图片、JSON 等其他内容。',T,4);
  e('browser','html','解析文档','浏览器解释 HTML 的结构；不是把任意标签当作代码执行。',T,4);
  e('html','tags','使用元素组织','HTML 通过元素描述结构，标签是元素的语法表示。',T,4);
  e('html','css','可引用样式','HTML 可以通过 link、style 等方式使用 CSS。',T,4);
  e('html','javascript','可引入脚本','HTML 可以通过 script 引入 JavaScript，以实现交互。',T,4);
  e('html','link','包含链接元素','a 是 HTML 元素之一；链接并不是 HTTP 协议本身。',T,4);
  e('link','url','href 指定目标','href 保存链接目标，可以是绝对地址，也可以是相对地址。',T,4);
  e('html','form','包含表单元素','form 组织输入控件及其提交方式。',T,4);
  e('form','get','可选择此方法','method="get" 选择 GET；表单也可以使用 POST，不能画成“表单只能 GET”。',T,4);
  e('get','http','属于请求方法','GET 是 HTTP 方法之一，用于请求资源表示。',T,4);
  e('http','headers','响应包含','HTTP 响应包含状态和头字段，并可能有正文。响应头不是 HTML 正文。',T,4);
  e('curl','http','作为客户端使用','curl 能发送 HTTP 请求；它还支持其他协议，并不限于 HTTP。',T,4);
  e('curl','headers','-I 请求查看','curl -I 通常发送 HEAD 请求，只显示响应头；这里是大写字母 I。',T,4);
  e('https','http','受保护的版本','HTTPS 是通过 TLS 保护的 HTTP，不是另一种网页标记语言。',T,3);
  e('https','encryption','保护传输','TLS 加密连接中的数据；这不代表网站本身绝对可信。',T,3);
  e('cookie','http','随适用请求发送','浏览器按域、路径、安全属性等规则发送 Cookie，不会把所有 Cookie 发给所有网站。',T,3);
  e('twofactor','password','补充单一密码','密码可以是一个验证因素；双因素需要另一个不同类型的因素。',T,3);
  e('manager','password','生成和保管','密码管理器可帮助避免多个网站重复使用同一密码。',T,3);
  e('manager','encryption','通常加密保管','课程中的密码管理器使用加密来保护保存的凭据。',T,3);
  e('vpn','encryption','可保护隧道','这里讨论课程中的加密 VPN 隧道；保护范围到 VPN 对端，不是整个互联网。',T,3);
  e('firewall','packet','按规则筛选','防火墙检查适用流量并按规则放行或阻止；这里是职责关系，不是访问网页的固定先后顺序。',T,3);
  e('image','pixels','可由像素表示','这里讨论课堂里的位图图像；不能把这一结论扩大到所有图形表示方式。',T,2);
  e('image','compression','可以采用','图像格式可以采用有损或无损压缩，具体取决于格式与编码方式。',T,2);
  e('mp3','audio','是音频格式','MP3 用来存储经过编码的数字音频。',T,2);
  e('mp3','compression','采用有损压缩','MP3 的压缩会舍弃部分音频信息；文件小不等于声音必然更好。',T,2);
  e('wav','audio','是音频容器','WAV 常用于存储 PCM 音频，但容器与具体编码不是一回事。',T,2);
  e('midi','audio','可用于合成','MIDI 指令可以驱动音源合成声音；MIDI 文件本身不等于录音。',T,2);
  e('video','image','由连续画面构成','视频包含随时间呈现的画面，通常也带有音轨。',T,2);
  e('pixels','binary','以位编码','像素颜色等数据最终以二进制数据存储；这不是可见颜色与单个位一一对应。',T,2);
  e('variable','string','可绑定到','Python 的变量可以绑定字符串值，也可以绑定其他类型的值。',P,0);
  e('variable','number','可绑定到','变量可以绑定 int、float 等数值对象。',P,0);
  e('function','return','可以返回值','return 把结果交给调用者；函数没有显式返回值时通常返回 None。',P,0);
  e('variable','function','引用值可作为参数','调用函数时可传入变量引用的值；参数并不只限于字面量。',P,0);
  e('condition','boolean','根据真假分支','条件表达式会被判断为真或假，从而选择执行分支。',P,1);
  e('loop','list','可逐项遍历','for 可以遍历列表，也可以遍历其他可迭代对象。',P,2);
  e('loop','dict','默认遍历键','for 遍历字典时默认得到键；可用键读取值。',P,2);
  e('loop','function','可重复调用','循环体中可以调用函数；函数并不依赖必须先有循环。',P,2);
  e('loop','boolean','while 检查真假','while 会反复检查条件的真假；for 则从可迭代对象取得元素。',P,2);
  e('try','exception','捕获指定异常','except 处理相应异常；应避免把所有错误都无差别吞掉。',P,3);
  e('module','function','可以提供函数','导入模块后可以调用它公开的函数；模块还可能提供常量和其他对象。',P,4);
  e('library','module','可通过模块组织','library 是可复用代码的宽泛称呼；在 Python 课堂中，通过模块与 import 来组织和使用这些代码。',P,4,'#libraries');
  e('library','random','标准库中的例子','random 是 Python 标准库里的模块；随 Python 提供，不需要另外用 pip 安装。',P,4,'#random');
  e('library','requests','第三方库的例子','requests 是第三方 HTTP 客户端库，课程使用 pip 安装，再在 Python 代码中 import。它不是标准库。',P,4,'#apis');
  e('module','random','标准库实例','random 是 Python 标准库中的模块之一，不必先用 pip 安装。',P,4);
  e('argv','list','是参数列表','sys.argv 是字符串列表，参数个数可用 len() 检查。',P,4);
  e('package','requests','可安装的包','requests 是需要安装的第三方包，不属于 Python 标准库。',P,4);
  e('requests','http','发送网络请求','requests.get() 等接口发出 HTTP 请求；Python 程序也能扮演 HTTP 客户端。',P,4);
  e('api','http','可通过它提供','课程展示的是 HTTP API；并非所有 API 都基于 HTTP。',P,4);
  e('api','json','可用它交换数据','HTTP API 经常返回 JSON，但也可以使用其他格式。',P,4);
  e('json','dict','可解析成','JSON 对象解析后可成为 Python 字典；JSON 文本本身不是 dict。',P,4);
  // A learning taxonomy is separate from semantic edges and lecture colors.
  // Its containers are navigation, not extra facts/nodes or prerequisites.
  const systems={
    python:{label:'Python 编程',color:'#e6c98e',branches:{basics:'名称与函数',types:'数据类型',flow:'控制流程',errors:'异常处理',reuse:'库与代码复用',cli:'命令行输入'}},
    web:{label:'Web 开发',color:'#79d8ca',branches:{structure:'网页结构 · HTML',style:'网页样式 · CSS',interaction:'网页交互 · JavaScript',client:'客户端与服务端'}},
    network:{label:'计算机网络',color:'#85b9fc',branches:{address:'地址与名称',transport:'数据传输',application:'应用层通信'}},
    hardware:{label:'计算机基础',color:'#b4a4e8',branches:{representation:'数据表示',components:'硬件组成',system:'系统软件'}},
    media:{label:'数字媒体',color:'#dc9fa9',branches:{images:'图像与颜色',audio:'声音与音乐',video:'动态画面',compression:'数据压缩'}},
    security:{label:'信息安全',color:'#b3d18b',branches:{crypto:'加密与传输保护',identity:'身份与凭据',access:'网络访问控制'}},
    shared:{label:'跨体系概念',color:'#a6bad8',branches:{interface:'软件接口',format:'数据交换格式'}}
  };
  function classify(system,branch,entries){for(const [id,kind,scope=''] of entries){const node=nodes.find(n=>n.id===id);if(!node)throw Error('Unknown taxonomy node: '+id);node.taxonomy={system,branch,kind,scope};}}
  classify('python','basics',[['variable','名称绑定'],['function','可调用代码单元','函数是通用编程概念；这里按 Python 课堂语境组织。'],['return','返回语句']]);
  classify('python','types',[['string','内置文本类型'],['number','内置数值类型'],['boolean','内置布尔类型'],['list','内置序列类型'],['dict','内置映射类型']]);
  classify('python','flow',[['condition','分支结构'],['loop','重复执行结构']]);
  classify('python','errors',[['exception','运行时异常机制'],['try','异常处理语句']]);
  classify('python','reuse',[['library','可复用代码的统称','库不是 Python 独有；这里展示 CS50P 中的库与使用方式。'],['module','代码组织 / 导入语句'],['random','标准库模块','随 Python 提供；不需要用 pip 安装。'],['package','代码组织 / 包安装工具','包与 pip 是组合知识点：包组织代码，pip 安装分发包；安装与 import 是不同步骤。'],['requests','第三方 HTTP 客户端库','不是 Python 标准库；需要在相应环境安装。']]);
  classify('python','cli',[['argv','sys 模块中的字符串列表','sys 属于 Python 标准库；argv 是其中的列表，不是独立的库。']]);
  classify('web','structure',[['html','标记语言'],['tags','元素的语法表示'],['link','HTML 超链接元素 / 属性'],['form','HTML 表单元素']]);
  classify('web','style',[['css','样式表语言']]);
  classify('web','interaction',[['javascript','编程语言','JavaScript 也可用于浏览器外；这里对应网页开发课。']]);
  classify('web','client',[['browser','客户端应用'],['server','服务端程序']]);
  classify('network','address',[['ip','网络层地址'],['domain','名称'],['dns','名称查询系统 / 协议'],['dhcp','网络配置协议'],['port','传输层端点标识'],['url','资源地址','也用于 Web 开发；不是网页内容或编程语言。']]);
  classify('network','transport',[['packet','传输数据单位'],['router','网络转发设备'],['tcp','传输层协议'],['udp','传输层协议']]);
  classify('network','application',[['http','应用层协议'],['https','受 TLS 保护的 HTTP','同时关联信息安全；不是另一种网页语言。'],['get','HTTP 请求方法'],['headers','HTTP 响应元信息'],['curl','命令行网络客户端','支持 HTTP 等多种协议；不是 Python 专属工具。'],['cookie','HTTP 状态管理机制','可用于会话与登录，安全课讨论了其风险；Cookie 本身不等于安全保护。']]);
  classify('hardware','representation',[['binary','数字表示方式'],['encoding','文字与数字的编码约定']]);
  classify('hardware','components',[['cpu','处理器'],['ram','运行时存储硬件'],['storage','持久化存储硬件']]);
  classify('hardware','system',[['os','系统软件']]);
  classify('media','images',[['pixels','图像单元 / 颜色表示'],['image','图像文件格式']]);
  classify('media','audio',[['audio','声音的数字表示'],['mp3','音频编码格式'],['wav','音频容器格式'],['midi','音乐演奏事件 / 指令']]);
  classify('media','video',[['video','随时间变化的画面']]);
  classify('media','compression',[['compression','减少数据体积的技术']]);
  classify('security','crypto',[['encryption','机密性保护技术'],['vpn','网络隧道技术','VPN 有多种实现；课堂语境为加密隧道。']]);
  classify('security','identity',[['password','身份验证凭据'],['twofactor','身份验证方式'],['manager','凭据管理工具']]);
  classify('security','access',[['firewall','流量访问控制工具']]);
  classify('shared','interface',[['api','软件调用接口','跨语言概念；本课用 Python 调用 HTTP API，并不代表 API 只属于 Python。']]);
  classify('shared','format',[['json','数据交换文本格式','跨语言格式；可以被解析成 Python 对象，但 JSON 本身不是 Python 的 dict。']]);
  return {nodes, edges, systems, groups:{web:{label:'网页',color:'#79d8ca'},network:{label:'网络',color:'#85b9fc'},python:{label:'Python',color:'#e6c98e'},hardware:{label:'硬件',color:'#b4a4e8'},media:{label:'多媒体',color:'#dc9fa9'},security:{label:'安全',color:'#b3d18b'}}};
})();
