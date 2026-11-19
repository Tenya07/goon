/* Read-only planning view; existing course checkboxes remain authoritative. */
const StudyRoadmap = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const directions = [
    {title:'数据分析', question:'一堆记录里，能看出什么？',
      before:'Python 函数、文件读写 + SQL 查询、分组、关联；补均值、中位数和图表读法。',
      task:'用自己记录或模拟的学习 / 游戏 CSV，清理缺失值、算每周时长、画一张图；解释图表能说明什么、不能说明什么。',
      deep:'Pandas、统计基础、数据可视化；数据分析不等于只会画图。',
      url:'https://pandas.pydata.org/docs/getting_started/intro_tutorials/',label:'Pandas 官方入门'},
    {title:'手机应用与移动网络', question:'学习本怎样在手机上更好用？',
      before:'HTML、CSS、JavaScript + HTTP、客户端与服务器；做原生 App 时再补对应平台工具。',
      task:'独立做一个手机尺寸的课程清单，能增加条目、保存到本机、重新打开还在；再追踪一次请求走过的网络。',
      deep:'想做 App 就深入平台开发；想懂连接原理就深入无线网络。两者相关，但不是同一门课。',
      url:'https://developer.mozilla.org/en-US/docs/Learn_web_development',label:'MDN Web 学习路径'},
    {title:'人工智能', question:'程序怎样搜索、预测或学习？',
      before:'熟练 Python、递归与基本数据结构；按主题补概率、向量和矩阵。CS50 AI 官方先修为 CS50x 或至少一年 Python 经验。',
      task:'实现一个小迷宫的路径搜索，对比不同方法访问的格子数；之后用模拟数据做简单预测，分开训练集与测试集。',
      deep:'CS50 AI 的搜索、知识表示、概率、学习等主题；调用聊天 API 是另一项应用技能。',
      url:'https://cs50.harvard.edu/ai/',label:'CS50 AI 官方课程'},
    {title:'密码学', question:'密码、哈希、加密分别解决什么？',
      before:'二进制、模运算、离散概率；先会读懂简单算法，再进入安全定义。',
      task:'用标准库比较文件哈希，观察改一个字后摘要如何变化；能解释哈希不是可解密的密文。',
      deep:'Dan Boneh 的 Cryptography I：对称加密、认证、公钥；练习算法与生产环境的安全实现分开。',
      url:'https://crypto.stanford.edu/~dabo/courses/OnlineCrypto/',label:'Stanford 密码学课程'},
    {title:'编译原理', question:'一行代码怎样被理解并执行？',
      before:'递归、树、栈 + 基础语法概念；读 Crafting Interpreters 的 Java 实现前先补 Java，C 实现前再补 C 与内存。',
      task:'做一个能计算带括号表达式的小计算器：分别说明分词、解析、求值，并处理非法输入。',
      deep:'Crafting Interpreters 从解释器入手；之后补类型检查、字节码、优化、代码生成，逐渐走向更完整的编译原理。',
      url:'https://craftinginterpreters.com/',label:'作者公开教材'},
    {title:'物联网 IoT', question:'现实里的设备怎样把数据送到程序？',
      before:'基础编程、网络请求、输入输出；接硬件时再补电路、电压与传感器基础。',
      task:'先用程序模拟温度传感器，把读数存进数据库并显示；确认喜欢这个过程后，再决定是否买硬件。',
      deep:'选择一个 Raspberry Pi / Pico 官方项目，真正采集数据、处理断线并展示；纯模拟只是体验，不代表硬件已经学会。',
      url:'https://projects.raspberrypi.org/en/projects',label:'Raspberry Pi 官方项目'}
  ];
  function progressLine(course) {
    if (!course || !course.total) return '还没有课程进度记录';
    return `讲次作业 ${Number(course.done)}/${Number(course.total)}` + (course.next ? ` · 下一步：${esc(course.next)}` : ' · 讲次作业已勾完，检查课程期末项目要求');
  }
  function render(progress = {}) {
    return `<section class="study-route" aria-labelledby="study-route-title" id="study-route">
      <header class="study-route-head"><div><p class="study-route-kicker">你的长期自学路线</p><h3 id="study-route-title">都想学，就按顺序探索</h3></div><span class="study-route-budget">每周 6 小时</span></header>
      <p class="study-route-intro">当前只推进 Python 和 SQL。后面的方向都有位置，但先不排进本周课表；完成一个阶段的小作品，再进入下一段。</p>
      <div class="study-route-now"><strong>现在：继续手上的两门课</strong><p>周一、周三 19:00–21:00：Python；周六 15:00–17:00：SQL（莫斯科时间）。学校有事可以跳过，下周不加倍补。</p><div class="study-route-progress"><p><b>CS50P</b> ${progressLine(progress.python)}</p><p><b>CS50 SQL</b> ${progressLine(progress.sql)}</p></div></div>
      <details class="study-route-step" open><summary>第一段 · 完成 Python + SQL</summary><div class="study-route-body">
        <p><b>学什么：</b>Python 按当前进度继续文件读写、正则、面向对象、Et Cetera，再做期末项目；SQL 按现有进度完成剩余章节、作业和期末项目。</p>
        <p><b>做什么：</b>用模拟课酬或学习记录，练习“读 CSV、检查数据、写入 SQLite、查询统计”，给关键函数写测试。可作为课程项目的候选，是否合格分别以两门课的官方要求为准。</p>
        <p><b>进入下一段前：</b>不用照抄也能从文件取数据、查询数据库、处理一种错误、解释一段测试为什么能发现问题。只看完视频还不算完成。</p>
        <p class="study-route-links">${link('https://cs50.harvard.edu/python/','CS50P 官方大纲')} ${link('https://cs50.harvard.edu/sql/','CS50 SQL 官方大纲')}</p>
      </div></details>
      <details class="study-route-step"><summary>第二段 · 做出一个自己能改的小网站</summary><div class="study-route-body">
        <p><b>顺序：</b>沿用已有 HTML / CSS、JavaScript 资源；已经会的内容用练习检查，不从头重复刷两套课程。再连接 Python 后端与数据库。</p>
        <p><b>时间怎么换：</b>Python 结课后，原来的 4 小时换成网页主线；SQL 未完成就保留周六 2 小时。两门都完成后，周六用于 Git、测试、修改同一个作品。</p>
        <p><b>完成标志：</b>独立做一个课程或曲目清单，能新增、搜索、保存；能追踪“点击按钮、发请求、服务器查询、页面显示”的全过程，并改好一个真实问题。</p>
        <p class="study-route-links">${link('https://developer.mozilla.org/en-US/docs/Learn_web_development','MDN 官方教材')} ${link('https://cs50.harvard.edu/x/','CS50x 网页与 Flask 章节')}</p>
      </div></details>
      <details class="study-route-step"><summary>第三段 · 补各方向共用的基础</summary><div class="study-route-body">
        <p><b>主线 4 小时：</b>先补 CS50x 的 C、数组、算法、内存、数据结构（Weeks 1–5），配相应练习；Python 和 SQL 已掌握的部分通过练习核验，不机械重学。之后按项目需要补操作系统与网络。</p>
        <p><b>副线 2 小时：</b>离散数学从逻辑、集合、计数、图、概率逐步补；AI 分支前再补向量、矩阵和必要的微积分。缺什么先补什么，不要求现在把所有数学课学完。</p>
        <p><b>完成标志：</b>能用栈、队列或树解决一个小问题，能比较两种算法的开销；能说明一次网络请求、进程与文件的基本关系。Java 留到需要它的分支前单独补。</p>
        <p class="study-route-links">${link('https://cs50.harvard.edu/x/','CS50x 官方课程')} ${link('https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/','MIT 离散数学')}</p>
      </div></details>
      <details class="study-route-step"><summary>第四段 · 六个方向逐个体验</summary><div class="study-route-body">
        <p>建议顺序：数据分析、手机应用与移动网络、AI、密码学、编译原理、物联网。顺序可以按兴趣调整，先修基础不跳过。</p>
        <p>每次只开一个方向。先给它约 6–12 小时做体验项目，这是预算，不是学完一门大学课的承诺；缺基础就把这一轮用来补基础，作品未完成就继续或暂存。</p>
        <div class="study-route-directions">${directions.map((d,i)=>`<details><summary>${i+1}. ${esc(d.title)}<span>${esc(d.question)}</span></summary><div><p><b>开始前：</b>${esc(d.before)}</p><p><b>先做一件事：</b>${esc(d.task)}</p><p><b>喜欢再深入：</b>${esc(d.deep)}</p>${link(d.url,d.label)}</div></details>`).join('')}</div>
      </div></details>
      <details class="study-route-step"><summary>第五段 · 选一个深入，其他继续保留</summary><div class="study-route-body">
        <p>体验后记录三件事：哪里有趣、哪里卡住、愿不愿意继续花时间。先选一个方向完成系统课程和更完整的项目，再轮到下一个；不要求放弃其他兴趣。</p>
        <p>继续按每周 4 小时深入 + 2 小时补基础、复习或完善作品。每两周检查实际精力和耗时，考试周减量，不用追旧日期。</p>
      </div></details>
      <footer class="study-route-foot">这是为你安排的自学路线，不是 UCC 的完整培养方案，也不兑换大学学分。六个方向沿用学习本的归类；其他选修以后按兴趣补充。UCC 四年级的 2025/26 方案为项目 15 + 选修 45 学分，旧说明中的“30”有误。${link('https://ucc-ie-public.courseleaf.com/programmes/bscs/bscs.pdf','核对官方方案')}</footer>
    </section>`;
  }
  return {render};
})();
