---
title: 基于Godot游戏开发全套专业术
tags: [godot, godot/材质, godot/动画骨骼, godot/术语, godot/术语, godot/网格, godot/纹理贴图, godot/物理碰撞, godot/渲染管线, godot/引擎资源]
abbrlink: godot-game-dev-professional-terms
lang: zh
published: 2026-07-02
---

适配：Godot4.x 全版本，兼顾 3D 游戏开发，剔除冗余图形学废话，全部结合**实际开发用法、制作工具、业务场景、易错坑点**，分为：渲染材质、模型网格、纹理贴图、动画骨骼、物理碰撞、引擎资源、渲染管线七大模块

核心串联关系：**网格 (Mesh) = 物体骨架形状 → 纹理 (Texture)=表面图案 → 材质 (Material)=表层属性 → 着色器 (Shader)=渲染运算规则 → GPU 最终绘制画面**

## 一、渲染材质类（最常用）

### 1. 材质 Material

#### 通俗释义

模型的「皮肤属性」，决定物体看起来是金属、木头、玻璃、发光、透明，是绑定 Shader+ 贴图 + 参数的配置载体，本身不是图像，也不是代码。

#### 底层原理

材质是**Shader 的参数配置文件**：储存颜色、粗糙度、贴图引用、透明度、自发光等变量，提交 GPU 后，由 Shader 读取参数执行渲染计算。

#### 核心作用

- 区分物体质感：石头坚硬、水面通透、车漆反光
- 挂载各类纹理贴图，统一管理渲染资源
- 隔离渲染配置：同一个 Shader，新建多个材质，就能做出木头/金属两种质感

#### 制作/处理工具

Godot 内置材质编辑器、Material Maker、Substance Designer

#### Godot 使用方法

1. 右键新建材质：新建→Resource→StandardMaterial3D
2. 绑定目标 Shader（默认 PBR 物理着色器）
3. 赋值颜色、贴图、粗糙度参数
4. 赋值给 MeshInstance3D.material_override

```gdscript
# 代码动态赋值材质
var metal_mat: StandardMaterial3D = preload("res://materials/metal.tres")
$MeshInstance3D.material_override = metal_mat
```

#### 使用场景

角色皮肤、墙体、载具、UI 面板、水面、发光特效、透明玻璃

#### 高频坑点

- 材质不能单独生效，必须依赖 Shader，空 Shader 材质直接黑屏
- 重复创建大量材质造成显存爆炸，相同质感复用同一个材质

#### Godot 实操示例

```gdscript
# 1. 全局复用材质（性能最优）
const MAT_WOOD: StandardMaterial3D = preload("res://materials/wood.tres")

# 2. 运行时动态修改材质参数
func modify_material_param():
    var mat = $MeshInstance3D.material_override as StandardMaterial3D
    mat.albedo_color = Color(1,0.3,0.2) # 修改固有色
    mat.roughness = 0.1 # 改为金属反光质感
```

#### 最佳实践

- 全局常驻材质统一用 preload 常量托管，禁止 _ready 内重复 new 材质
- 同款模型、同款质感强制复用同一个材质文件，降低显存占用
- 透明物体材质开启透明模式，关闭阴影渲染，优化性能
- 禁止在 _process 逐帧修改材质参数，引发渲染卡顿

### 2. 着色器 Shader

#### 通俗释义

GPU 专属渲染脚本，**告诉显卡怎么画图**：计算颜色、反光、阴影、扭曲、发光，是所有画面效果的底层逻辑；材质只是填参数，Shader 才是计算公式。

#### 底层分类（必懂）

- **顶点着色器 Vertex Shader**：运算模型顶点位置、形变（布料飘动、模型摇摆）
- **片元/像素着色器 Fragment Shader**：运算每一个像素颜色、反光、透明度（90% 特效写在这里）

#### 核心作用

- 官方 Shader 做不到的特效：空气热扭曲、卡通描边、全息投影、水面波动
- 优化渲染：剔除无用像素、降低 GPU 开销
- 实现光影逻辑：PBR 光照、自发光、折射

#### 制作工具

Godot Shader 编辑器、Shader Graph 可视化编辑器、VS Code 编写 shader 代码

#### Godot 分类与用法

- 内置 Shader：StandardMaterial3D（PBR 物理渲染，写实游戏）、CanvasItem（UI 专用）
- 自定义 Shader：新建.shader 文件，挂载到材质

```glsl
// Godot极简片元着色器示例
shader_type spatial;
void fragment(){
    ALBEDO = vec3(0.2,0.6,1.0); // 物体固有色
}
```

#### 使用场景

卡通渲染、夜视滤镜、水面、护盾、描边、体积雾、屏幕后处理、光影畸变

#### 易错点

- Shader 运行在 GPU，不能读取游戏脚本变量，需要材质导出参数传值
- 自定义 Shader 极易造成显存暴涨，冗余运算必须删减

#### Godot 实操示例

```gdscript
# 代码传递外部参数给自定义Shader（解决GPU无法读取脚本变量）
@export var shader_mat: ShaderMaterial
var shine_value: float = 0.0

func _process(delta):
    # 向shader传递数值，实现亮度动态变化
    shine_value += delta * 0.5
    shader_mat.set_shader_parameter("shine", shine_value)
```

#### 最佳实践

- 通用光影优先使用内置 StandardMaterial3D，自定义 Shader 仅做特殊特效
- Shader 内部精简冗余计算，废弃无效 if 判断，防止 GPU 过热降帧
- 所有外部变量，统一通过 set_shader_parameter 传参，禁止跨线程读写
- 自定义 Shader 做好资源分组，废弃不用的 Shader 及时删除，减少打包体积

### 3. PBR 物理渲染

#### 通俗释义

一套**真实光影计算标准**，让金属反光、木头漫反射、玻璃折射符合现实物理规则，不用手动调光影，画面自动写实。

#### 四大核心 PBR 贴图

- Albedo（反照率/固有色）：基础颜色，不受光照影响
- Normal（法线）：模拟凹凸纹理，不改模型形状，只改光影
- Roughness（粗糙度）：0 镜面金属，1 哑光泥土
- AO（环境遮蔽）：缝隙变暗，避免模型缝隙发白，提升质感

#### 使用场景

#### Godot 实操示例

```gdscript
# PBR材质完整赋值代码
func _ready():
    var pbr_mat: StandardMaterial3D = StandardMaterial3D.new()
    # 基础固有色
    pbr_mat.albedo_texture = preload("res://textures/rock_albedo.png")
    # 法线凹凸
    pbr_mat.normal_texture = preload("res://textures/rock_normal.png")
    # 金属+粗糙度
    pbr_mat.metallic_texture = preload("res://textures/rock_metal.png")
    pbr_mat.roughness_texture = preload("res://textures/rock_rough.png")
    # 环境遮蔽
    pbr_mat.ao_texture = preload("res://textures/rock_ao.png")
    $MeshInstance3D.material_override = pbr_mat
```

#### 最佳实践

- 写实项目全部启用 PBR 渲染，关闭老旧固定光照模式
- 四张 PBR 贴图分辨率统一，避免光影错位闪烁
- 非金属材质金属度固定 0，杜绝错误反光
- 纯白 AO 贴图直接删除，无效贴图占用显存

写实 3D 游戏、枪械、建筑、地形、角色，Godot 默认材质全部基于 PBR

## 二、模型网格类（3D 形体基础）

### 1. 网格 Mesh

#### 通俗释义

3D 物体的**骨架**，所有 3D 模型本质都是无数个拼接的三角形；决定物体长宽高、外形、曲面轮廓。

#### 底层组成

- 顶点 Vertex：空间坐标点，网格最小单位
- 三角面 Face：三个顶点拼成面片，GPU 只识别三角形
- 法线 Normal：记录表面朝向，决定光照明暗
- UV：贴图映射坐标，决定花纹贴在模型哪个位置

#### 制作工具

Blender、Maya、3ds Max、Cinema 4D

#### Godot 使用方法

- 外部导出 glb/gltf 格式（Godot 最优格式）
- 挂载至 MeshInstance3D 节点渲染显示
- 代码生成简易网格：MeshDataTool 动态生成地形、面片

#### 关键术语：面数、顶点数

面数越高模型越精细、帧率越低；手游单角色建议 8000 面以内，PC 端 2 万面以内

#### 踩坑

#### Godot 实操示例

```gdscript
# 代码生成基础立方体网格（运行时生成模型）
func create_runtime_mesh():
    var mesh_tool = MeshDataTool.new()
    var cube_mesh = BoxMesh.new()
    $MeshInstance3D.mesh = cube_mesh
```

#### 最佳实践

- 外部模型统一导出 GLTF2.0 格式，禁用 FBX，导入报错最少
- 模型导入关闭多余烘焙、动画导入，精简冗余数据
- 静态场景模型开启 Bake Light 烘焙光照，提升帧率
- 废弃模型及时清理，防止冗余资源打包进安装包

反向法线：模型变黑、不反光，建模软件翻转法线即可修复

### 2. 碰撞网格 CollisionMesh

#### 通俗释义

物理专用隐形网格，**不渲染、看不见，只用来碰撞检测**；和渲染网格分离，专门优化物理性能。

#### 分类

- 精细碰撞网格：和模型一模一样，碰撞精准，性能差
- 简化碰撞网格：立方体、胶囊体替代模型，碰撞模糊，性能极高（开发首选）

#### 使用场景

#### Godot 实操示例

```gdscript
# 运行时替换简化碰撞体，优化物理性能
func set_simple_collision():
    # 清空高精度网格碰撞
    $CollisionShape3D.disabled = true
    # 新建胶囊简化碰撞（角色最优碰撞体）
    var capsule = CapsuleShape3D.new()
    capsule.height = 1.8
    capsule.radius = 0.4
    $SimpleCollision.shape = capsule
```

#### 最佳实践

- 角色、NPC 强制使用胶囊碰撞，杜绝模型网格碰撞
- 墙体、地形统一使用 Box 形状碰撞
- 碰撞形状稍微缩小 0.05，防止模型边缘卡地形
- 不可见道具、特效直接关闭碰撞组件，节省算力

角色碰撞、墙体阻挡、子弹命中、地形碰撞，也就是你之前物理 layer 绑定的碰撞体

### 3. 模型预制体 Prefab/PackedScene

#### 通俗释义

打包完毕的成品节点模板，角色、NPC、子弹、道具打包成独立文件，可随时实例化生成，参数、脚本、材质全部保留。

#### Godot 对应术语

Godot 无 Prefab，等价为**PackedScene（.tscn）**

#### Godot 最佳实践

- 可复用实体（子弹、NPC、道具）全部打包独立 PackedScene
- 高频生成预制体，全局 preload 缓存，禁止运行时 load 加载场景
- 实例化无用节点及时 queue_free，防止节点泛滥卡顿
- 分层拆分预制体：物理、视觉、逻辑节点分离，方便迭代维护

## 三、纹理贴图类（表面细节）

### 1. 纹理 Texture

#### 通俗释义

贴在网格表面的图片，给纯白模型印花纹，就是贴图；所有贴图统称为 Texture。

#### 制作工具

Photoshop、Krita、Substance Painter、Aseprite(像素)

#### 六大常用贴图细分（开发必背）

- **Albedo 固有色贴图**：花纹、颜色，最基础贴图
- **Normal 法线贴图**：低成本模拟凹凸、划痕、纹路，不增加模型面数，提升画质
- **Roughness 粗糙度贴图**：黑白图，白=哑光，黑=反光
- **Metallic 金属度贴图**：黑白图，白=金属，黑=非金属
- **AO 环境光遮蔽贴图**：模型缝隙变暗，消除浮空发白，提升层次感
- **Emission 自发光贴图**：灯光、屏幕、火焰，不受场景光照影响，自主发光

#### 压缩格式（打包必备）

- PC：BPTC 压缩
- 移动端：ETC2、ASTC 压缩，不压缩显存直接爆炸

#### Godot 实操示例

```gdscript
# 运行时修改贴图、动态切换皮肤
var skin_list = [
    preload("res://textures/skin1.png"),
    preload("res://textures/skin2.png")
]

func switch_skin(index: int):
    var mat = $MeshInstance3D.material_override as StandardMaterial3D
    mat.albedo_texture = skin_list[index]
```

#### 最佳实践

- 贴图导入开启 VRAM 显存压缩，发布打包必须开启 ETC2/BPTC
- 贴图尺寸统一 2 的幂次：128/256/512/1024，防止拉伸模糊
- 透明贴图单独分离，不要合并 PBR 基础贴图
- 无用贴图勾选忽略导入，精简打包资源体积

### 2. UV 坐标

#### 通俗释义

模型表面的「贴纸坐标」，把 2D 图片铺平贴到 3D 曲面；UV 错乱=花纹拉伸、扭曲、翻面。

#### 作用

控制贴图平铺、拉伸、镜像；无缝地砖、角色皮肤全部依赖展开 UV

### 2. UV 坐标

#### 通俗释义

模型表面的「贴纸坐标」，把 2D 图片铺平贴到 3D 曲面；UV 错乱=花纹拉伸、扭曲、翻面。

#### 作用

控制贴图平铺、拉伸、镜像；无缝地砖、角色皮肤全部依赖展开 UV

#### Godot 实操示例

```gdscript
# 代码修改UV平铺，实现地砖无缝重复铺贴
func set_tile_uv():
    var tile_mat = $MeshInstance3D.material_override as StandardMaterial3D
    # uv1：水平平铺4倍、垂直平铺4倍
    tile_mat.uv1_scale = Vector2(4.0,4.0)
    # 偏移UV，滑动地面纹理
    tile_mat.uv1_offset.x += 0.1
```

#### 最佳实践

- 建模阶段拆分规整 UV，重叠 UV 会造成贴图闪烁、染色异常
- 重复地砖、墙体纹理，禁止放大贴图，改用 UV 平铺实现
- 角色模型 UV 拆分分区，皮肤、衣物拆分独立 UV，方便换色
- 导入模型勾选保存 UV，禁止引擎自动重构 UV，避免贴图错位

### 3. 图集 Texture Atlas

#### 通俗释义

把几十张小图合并成一张大图，减少显卡渲染次数，极致优化帧率

#### 使用场景

UI 图标、特效序列帧、像素贴图，禁止零散小图导入游戏

#### Godot 实操示例

```gdscript
# 加载图集，截取局部图标渲染
func get_atlas_icon():
    # 加载合并后的大图图集
    var atlas = preload("res://ui/ui_atlas.png")
    # 截取图集：x,y,宽,高 截取单个图标
    var icon = atlas.get_region(Rect2(0,0,64,64))
    $TextureRect.texture = icon
```

#### 最佳实践

- UI 资源全部合并图集，单图集尺寸控制 2048×2048 以内
- 特效序列帧强制打图集，防止渲染卡顿、DrawCall 暴涨
- 功能性贴图（法线、AO）禁止合并图集，容易光影错乱
- 图集预留空白边距，防止像素溢出、边缘串色

#### 通俗释义

把几十张小图合并成一张大图，减少显卡渲染次数，极致优化帧率

#### 使用场景

UI 图标、特效序列帧、像素贴图，禁止零散小图导入游戏

## 四、动画骨骼类

### 1. 骨骼 Bone

#### 通俗释义

模型内部隐形骨架，类似人体骨头，拉动骨骼，带动模型形变；无骨骼模型只能整体平移，无法摆动作。

#### 分类

- 绑定骨骼：角色、动物、拟人模型
- 形变骨骼：旗子飘动、头发摆动、布料

#### Godot 实操示例

```gdscript
# 运行时获取骨骼、手动控制手部骨骼旋转
func control_bone():
    # 获取骨架节点
    var skeleton = $Skeleton3D
    # 获取右手骨骼索引
    var hand_idx = skeleton.find_bone("hand_r")
    # 旋转骨骼，抬手动作
    skeleton.set_bone_rotation(hand_idx, Euler(0,rad_to_deg(30),0))
```

#### 最佳实践

- 角色骨骼命名统一英文命名，禁止中文骨骼，导入报错崩溃
- 精简冗余骨骼，手指、配饰多余骨骼直接删除，降低算力
- 物理飘动毛发、裙摆，单独拆分形变骨骼，不参与动作烘焙
- 导入模型关闭骨骼缩放继承，防止动作变形

### 2. 蒙皮 Skin

#### 通俗释义

骨骼绑定网格权重，让骨头拉动模型；权重异常=肢体扭曲、拉伸变形、穿模

#### Godot 实操示例

```gdscript
# 运行时修复异常蒙皮权重（简易修复）
func fix_skin_weight():
    var skin = $Skeleton3D.get_skin()
    # 重置骨骼权重，修复肢体拉伸
    skin.clear_bone_weights()
```

#### 最佳实践

- 关节位置权重平滑过渡，禁止权重硬断层，杜绝肢体弯折撕裂
- 单顶点最多绑定 3 根骨骼，绑定过多严重掉帧
- 刚体配饰（头盔、武器）取消蒙皮，直接挂点挂载

### 3. 动画剪辑 Animation Clip

拆分完毕的动作片段：待机、跑步、跳跃、攻击；Godot 存放于 AnimationPlayer，单独.anim 资源

#### Godot 实操示例

```gdscript
# 代码播放、切换动画剪辑
@export var anim_player: AnimationPlayer
const ANIM_IDLE = preload("res://anim/idle.anim")

func play_idle_anim():
    # 播放待机动画，开启循环
    anim_player.play(ANIM_IDLE.resource_path)
    anim_player.animation_loop_mode = AnimationPlayer.LOOP_LINEAR
```

#### 最佳实践

- 动作拆分独立动画剪辑，禁止单文件整合全部动作
- 烘焙动画精简关键帧，删除冗余帧，减小资源体积
- 攻击、技能动画开启插值，消除动作顿挫

### 4. 状态机 Animator

动画控制器，控制动作切换、过渡、融合；解决跑步切跳跃卡顿、动作硬切，Godot 对应 `AnimationTree`

#### Godot 实操示例

```gdscript
# 动画状态机切换动作，平滑过渡
@export var anim_tree: AnimationTree

func switch_run_anim():
    # 修改状态机参数，平滑切换跑步动作
    anim_tree.set_parameter("is_run",true)
```

#### 最佳实践

- 复杂角色全部使用 AnimationTree，废弃原生 AnimationPlayer 做动作切换
- 动作过渡时长统一 0.1~0.2s，手感最流畅
- 动作互斥分组，禁止跑步、攻击同时播放

### 1. 骨骼 Bone

#### 通俗释义

模型内部隐形骨架，类似人体骨头，拉动骨骼，带动模型形变；无骨骼模型只能整体平移，无法摆动作。

#### 分类

- 绑定骨骼：角色、动物、拟人模型
- 形变骨骼：旗子飘动、头发摆动、布料

### 2. 蒙皮 Skin

#### 通俗释义

骨骼绑定网格权重，让骨头拉动模型；权重异常=肢体扭曲、拉伸变形、穿模

### 3. 动画剪辑 Animation Clip

拆分完毕的动作片段：待机、跑步、跳跃、攻击；Godot 存放于 AnimationPlayer，单独.anim 资源

### 4. 状态机 Animator

动画控制器，控制动作切换、过渡、融合；解决跑步切跳跃卡顿、动作硬切，Godot 对应 `AnimationTree`

## 五、物理相关术语（对应你碰撞层）

### 1. 碰撞形状 CollisionShape

物理碰撞外形，胶囊、立方体、球体；**优先使用基础碰撞体，禁止高精度网格碰撞**

#### Godot 实操示例

```gdscript
# 动态生成球体碰撞，用于子弹判定
func spawn_bullet_collision():
    var bullet_col = CollisionShape3D.new()
    var sphere = SphereShape3D.new()
    sphere.radius = 0.15
    bullet_col.shape = sphere
    $Bullet.add_child(bullet_col)
```

#### 最佳实践

- 碰撞形状和渲染模型分离摆放，不要贴合模型边界
- 旋转物体使用胶囊、球体碰撞，杜绝方块卡顿
- 子弹、投掷物轻量化碰撞，关闭碰撞持续检测

### 2. 物理层 Layer / 掩码 Mask

身份标签 + 检测过滤器，你前文学习内容，隔离碰撞交互，优化物理算力，隔离敌我、环境、道具

#### Godot 实操示例

```gdscript
# 代码设置物理层，玩家仅碰撞地形、不碰撞NPC
func set_player_physics_layer():
    # 设置自身层级：玩家层
    collision_layer = 1 << 1
    # 设置检测掩码：只检测地形
    collision_mask = 1 << 0
```

#### 最佳实践

- 固定分层规则：地形、玩家、敌人、道具、UI 分层隔离
- 伤害检测单独分层，不参与实体碰撞阻挡
- 关闭无用物理层检测，大幅降低物理开销

### 3. 刚体 RigidBody

受重力、外力、物理引擎全权控制，掉落石块、子弹、杂物，程序不能直接修改 position

#### Godot 实操示例

```gdscript
# 给刚体施加外力，实现抛掷石块
func throw_stone():
    $RigidBody3D.apply_central_force(transform.basis.z * 300)
```

#### 最佳实践

- 禁止代码直接修改 rigidbody.position，造成物理抖动、穿墙
- 落地静止刚体开启休眠，节省物理算力
- 高速移动刚体开启连续碰撞，防止穿墙穿透

### 4. 运动体 CharacterBody

角色专属物理体，程序控制位移，物理引擎修正碰撞，玩家、NPC 专用，也就是你的 Player 根节点

#### Godot 实操示例

```gdscript
# 角色基础移动代码（标准写法）
func _physics_process(delta):
    var input_dir = Input.get_vector("move_left","move_right","move_forward","move_back")
    velocity = transform.basis * input_dir * 5.0
    move_and_slide()
```

#### 最佳实践

- 玩家、NPC 全部使用 CharacterBody3D，禁止刚体做角色
- 移动逻辑强制写入 _physics_process，杜绝 _process
- 角色碰撞永远使用胶囊碰撞体

### 5. 区域体 Area

无物理阻挡，只做探测、触发、伤害判定；传送门、拾取、伤害框、怪物探测

#### Godot 实操示例

```gdscript
# 探测进入区域的角色，触发拾取
func _ready():
    $Area3D.body_entered.connect(_on_item_pickup)

func _on_item_pickup(body):
    if body.is_in_group("Player"):
        print("拾取道具")
        queue_free()
```

#### 最佳实践

- 伤害、探测全部使用 Area，不用碰撞体检测
- 探测区域关闭物理阻挡，避免卡住角色
- 闲置探测 Area 临时禁用，减少物理轮询

### 1. 碰撞形状 CollisionShape

物理碰撞外形，胶囊、立方体、球体；**优先使用基础碰撞体，禁止高精度网格碰撞**

### 2. 物理层 Layer / 掩码 Mask

身份标签 + 检测过滤器，你前文学习内容，隔离碰撞交互，优化物理算力，隔离敌我、环境、道具

### 3. 刚体 RigidBody

受重力、外力、物理引擎全权控制，掉落石块、子弹、杂物，程序不能直接修改 position

### 4. 运动体 CharacterBody

角色专属物理体，程序控制位移，物理引擎修正碰撞，玩家、NPC 专用，也就是你的 Player 根节点

### 5. 区域体 Area

无物理阻挡，只做探测、触发、伤害判定；传送门、拾取、伤害框、怪物探测

## 六、引擎资源加载术语

### 1. 资源 Resource

Godot 所有可复用文件统称：场景、材质、贴图、音频、Shader、脚本，全部继承 Resource，全局缓存

### 2. 预加载 Preload

编译期加载，运行零卡顿，固定常驻资源专用

### 3. 动态加载 Load

运行时同步加载，可拼接路径，大资源卡顿

### 4. 异步加载 ThreadedLoad

子线程后台加载，不卡帧，超大场景、高清贴图专用

### 5. 序列化 Serialize

节点、数据转存档文件，用于存档、配置导出

## 七、渲染&画面术语

### 1. 渲染管线 Render Pipeline

画面生成全流程：顶点→光栅化→片元→输出屏幕；Godot 分为**前向渲染、兼容渲染**

### 2. 抗锯齿 AA

消除物体边缘锯齿、狗牙；FXAA 性能高，TAA 画质好，移动端必开 FXAA

### 3. 景深 DOF

对焦近处清晰、远景模糊，模拟相机对焦，提升画面氛围感

### 4. 泛光 Bloom

高亮物体发光外溢，灯光、火焰、太阳光光晕效果

### 5. 帧缓冲 FrameBuffer

屏幕画面临时画布，屏幕后处理、滤镜全部修改画布实现

## 八、节点生命周期术语（你之前学的）

- **_init**：脚本构造，未入树
- **_enter_tree**：挂载场景树
- **_ready**：节点 + 子资源全部就绪
- **Notification 通知**：引擎底层事件回调，生命周期底层原型
- **Process**：渲染帧、视觉逻辑
- **PhysicsProcess**：固定物理帧、运动逻辑

## 九、程序高频混淆术语对照表（避坑）

|极易混淆术语|核心区别|
|---|---|
|Mesh 网格 vs CollisionMesh 碰撞网格|Mesh 渲染画面；CollisionMesh 隐形负责物理，互相独立|
|Material 材质 vs Shader 着色器|Shader 是计算公式，Material 是填参配置；Shader 决定上限，材质调效果|
|Texture 贴图 vs Albedo 颜色|纯色不用贴图；复杂花纹必须贴图，纯色贴图浪费显存|
|RenderLayer 渲染层 vs PhysicsLayer 物理层|完全隔离：一个管看不看得见，一个管碰不碰|
|instantiate 实例化 vs add_child 挂载|instantiate 生成对象；add_child 加入场景树执行生命周期|

## 十、完整资源生产链路（商业游戏流水线）

建模 (Blender) → 拆分 UV → 绘制贴图 (Substance) → 绑定骨骼蒙皮 → 导出 GLB → Godot 导入 → 编辑材质绑定 Shader → 挂载碰撞体 → 编写动画状态机 → 编写物理逻辑 → 打包发布

## 十一、极简通俗顺口溜（方便记忆）

网格撑外形，贴图画皮囊

材质调质感，着色定算法

骨骼控动作，碰撞管物理

分层隔交互，加载控性能
