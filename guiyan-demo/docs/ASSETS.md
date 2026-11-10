# 网站内容与素材清单

当前展示入口为H5、电脑网站、管理后台。资源目录在原22项基础上补充40项，覆盖演出、场馆、艺人、设备、版权、非遗、文创、数字演出、文旅与配套服务10类；增加6条合作需求及18条模拟评价。已有账号、订单、价格与库存不清空、不重置。

所有内容都是毕业实习模拟数据，不代表真实可售项目、实际价格或商家承诺。照片由内置Image Gen生成，不使用真人名人肖像、商业品牌标志或真实演出海报。旧场馆和演出照片保留，新增图片以独立文件保存。

| 网页素材 | 简要生成提示词 | 用途 |
| --- | --- | --- |
| `desktop-performance.webp` | 广西壮乡群舞，红与青绿刺绣服饰、木舞台、喀斯特山水；3:1全景，主舞者位于右侧，左侧林荫留白；无文字标志 | 电脑网站主视觉 |
| `folk-performer.webp` | 壮族舞台演员，彩色头饰、红青服饰与编织道具，暖色舞台光；无名人、文字或水印 | 演出剧目 |
| `venue-evening.webp` | 现代广西演艺空间概念建筑，镂空金铜立面、蓝调夜空、温暖灯光；无真实场馆标识 | 场馆空间 |
| `ensemble.webp` | 琵琶、古筝与笛箫室内乐排练，象牙白与靛蓝服装、琥珀舞台灯 | 艺人和器乐演出 |
| `heritage-workshop.webp` | 壮锦手作工坊，工匠双手与木织机，朱红靛蓝织物、自然窗光 | 非遗体验和专题 |
| `cultural-gifts.webp` | 壮锦香囊、织物小包、铜鼓摆件与竹编，浅色台面、自然侧光 | 文创产品 |
| `stage-equipment.webp` | 专业调音台、舞台灯架与音箱，暖琥珀和朱红实景灯光 | 设备租赁和配套服务 |
| `river-evening.webp` | 漓江竹筏、喀斯特山水倒影、蓝调时刻与滨水民俗演出 | 文旅与旅行专题 |
| `digital-landscape.webp` | 数字展厅中的翡翠色山水投影、流水与观众剪影，真实房间透视 | 数字演出和视觉内容 |
| `performance.webp`、`venue.webp` | 既有生成示意图片的网页编码版本 | H5主视觉和兼容素材 |

新增素材均先生成独立照片并检查内容，再转换为WebP用于网页传输；11张主图保持原画面和像素尺寸，合计约3.36MB，原始PNG总计约29.72MB。另提供8张640像素宽的卡片派生图，通过`srcset`按显示尺寸选用，减少手机和资源列表的流量。图片按位置懒加载，主视觉优先加载。原始生成结果保留在本机Image Gen输出目录。

资源图片以`public/images/`为准，内容和分类映射见`server/catalog-content.mjs`。补充内容在数据库事务内执行，通过`catalog-content-2026-v2`标记避免重启后重复插入；自定义图片不被覆盖。


## 历史来源记录（保留）

以下是旧素材与旧设计图的生成记录，仅保留来源，不属于当前产品入口。

# 图像生成记录

所有位图使用内置 Image Gen 工具生成。图标来自代码中的 Lucide 图标组件，转换为本地PNG供小程序使用。没有在用户端调用图像生成API。

## 界面参考

文件：`design-concept.png`。

提示要点：为“桂演 · 广西演艺资源平台”创建中文三端产品界面参考；桌面管理后台、H5、原生微信小程序共用视觉体系。深海军蓝侧栏、冷灰背景、白色表面、绿色主色。后台包含9个导航、4个指标、交易折线趋势、渠道占比、最近订单与推荐资源。移动端包含品牌、搜索、民族歌舞图片、资源分类、推荐列表和底部导航。所有文字、控件、表格须由代码实现，不把生成图片当作UI。

## 民族歌舞示意图

文件：`public/images/performance.png`。

生成提示：Create a photographic website banner asset, landscape 1536x1024, for a Guangxi performing arts demo app. A beautiful traditional Zhuang folk dance theatre performance, wide stage with dancers in rich red and turquoise embroidered costumes, elegant dark emerald forest and limestone karst stage scenery, warm theatrical spotlights, realistic stage photography, polished culturally respectful performance. Full stage panoramic framing, no UI, no captions, no lettering, no logos. Keep the upper left part dark emerald and relatively quiet so the app can place a short white heading there. This will be cropped as a wide mobile banner and theatre resource thumbnails.

## 虚构剧场示意图

文件：`public/images/venue.png`。

生成提示：Create a photographic architectural website resource asset, landscape 1536x1024. An illustrative fictional contemporary performing arts center in Nanning Guangxi at blue hour, a sculptural modern glass and warm ivory stone theatre with golden illuminated interior, welcoming entrance plaza, reflected lights, sparse people, elegant trees, clean editorial architectural photography. Front three-quarter angle, building occupies most of image, navy blue evening sky. For a graduation demo, no recognizable copyrighted signage or branding, no lettering, no watermarks, no UI.

图片不证明所列场馆、人物、演出或活动真实存在，也不提供相关版权授权。
