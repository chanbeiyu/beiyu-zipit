---
title: Godot4 资源加载
tags: [godot, godot/资源加载, godot/load]
abbrlink: godot-resource-loading
lang: zh
published: 2026-07-03
---

## 前置基础：Godot 资源底层机制

### 1. 资源缓存核心机制

Godot 所有资源（贴图、场景、音频、脚本、材质）全部**全局单例缓存**：

- 同一个路径资源，加载一次后引擎永久缓存，后续所有加载调用直接取缓存，不会重复读取磁盘
- 资源路径必须使用 **<res://**> 相对工程路径，禁止绝对路径（打包失效
- 缓存清空方式：手动 ResourceCache.remove() / 切换场景自动释放无引用资源

### 2. 加载分类总览

1. **静态加载**：导出变量赋值、编辑器拖拽绑定、编译期预加载
2. **预加载 preload()**：脚本编译阶段加载资源，阻塞编辑器、运行零开销
3. **动态加载 load()**：运行时同步加载，阻塞游戏线程
4. **异步加载 ResourceLoader**：运行时后台加载，不卡顿游戏，大型资源专用

## 一、静态加载（无需代码，最简单）

**定义**：不书写加载代码，依靠编辑器绑定、导出变量自动加载，引擎进入场景自动预加载资源

### 1. 编辑器拖拽绑定（最常用）

适用：材质、贴图、音效、动画、粒子资源
操作：直接将文件从文件面板拖拽到节点 Inspector 属性，引擎自动完成加载
优缺点：零代码、不会报错；资源硬绑定，无法热切换、动态更换资源

### 2. @export 导出变量静态加载

书写资源类型导出变量，编辑器赋值，场景加载自动加载资源

```gdscript
extends Node3D

# 导出资源类型，编辑器拖拽赋值，【静态加载】
@export var player_scene: PackedScene       # 角色场景
@export var sound_jump: AudioStream         # 跳跃音效
@export var tex_body: Texture2D             # 角色贴图
@export var mat_metal: StandardMaterial3D   # 材质资源

func _ready():
    # 直接使用，无需加载代码，资源已经就绪
    $AudioStreamPlayer.stream = sound_jump
```

### 3. 脚本静态常量加载（编译期）

直接全局常量赋值，属于静态加载，等价 preload，编译阶段载入资源

```gdscript
# 全局作用域，编译期静态加载
const BULLET_SCENE: PackedScene = preload("res://scenes/bullet.tscn")
const ICON_TEX: Texture2D = preload("res://textures/icon.png")
```

### 静态加载适用场景&弊端

✅ 适用：固定不变的资源、UI 图标、基础材质、常驻音效
❌ 弊端：场景启动全部加载，启动慢、占用内存高；无法按需加载、无法热更新

## 二、预加载 preload()【高频最优】

### 1. 核心特性

- 执行时机：**脚本编译时加载**，不是游戏运行时
- 加载阻塞：阻塞编辑器编译，**游戏运行零加载开销**
- 缓存机制：永久缓存，全局共享
- 报错特性：路径错误**编辑器直接爆红**，运行不会崩溃

### 2. 语法&全资源示例（带注释）

```gdscript
extends Node3D

# 1. 预加载场景文件【最常用】
const PLAYER_SCENE: PackedScene = preload("res://scenes/player.tscn")
# 2. 预加载贴图资源
const PLAYER_TEX: Texture2D = preload("res://textures/player.png")
# 3. 预加载音频
const JUMP_SOUND: AudioStream = preload("res://sounds/jump.wav")
# 4. 预加载材质
const RED_MAT: StandardMaterial3D = preload("res://materials/red_mat.tres")
# 5. 预加载GDScript脚本
const SKILL_SCRIPT: GDScript = preload("res://scripts/skill.gd")
# 6. 预加载动画资源
const IDLE_ANIM: Animation = preload("res://animations/idle.anim")

func _ready():
    # 直接实例化、使用，无任何加载延迟
    var player = PLAYER_SCENE.instantiate()
    add_child(player)

    # 赋值材质
    $MeshInstance3D.material_override = RED_MAT
```

### 3. preload 优缺点

✅ 优点：运行极快、代码简洁、编译报错提前暴露、无卡顿
❌ 缺点：

- 必须写死资源路径，无法动态拼接路径
- 大量 preload 会增加编辑器编译耗时
- 无法加载外部热更新资源

💡**工程最佳规范**：所有常驻资源、基础预制体，全部使用 preload 常量定义

## 三、同步动态加载 load()

### 1. 核心特性

- 执行时机：**游戏运行时实时加载**
- 加载阻塞：阻塞主线程，加载期间游戏冻结、画面卡顿
- 支持动态拼接路径，灵活度极高
- 路径错误：运行时报错，编辑器不提示

### 2. 基础用法 + 全资源示例

```gdscript
extends Node3D

func _ready():
    # 1. 动态拼接路径，加载不同皮肤贴图【preload做不到】
    var skin_id = 2
    var tex_path = "res://textures/skin_%d.png" % skin_id
    var skin_tex: Texture2D = load(tex_path)
    $MeshInstance3D.texture_override = skin_tex

    # 2. 动态加载场景
    var enemy_scene: PackedScene = load("res://scenes/enemy_01.tscn")
    add_child(enemy_scene.instantiate())

    # 3. 动态加载脚本并附加
    var runtime_script: GDScript = load("res://scripts/buff.gd")
    $Player.set_script(runtime_script)

    # 4. 容错写法（防止资源不存在崩溃）
    var safe_res = load("res://textures/null.png")
    if safe_res != null:
        print("资源加载成功")
    else:
        print("资源缺失")
```

### 3. load() 与 preload() 核心区别

|特性|preload()|load()|
|---|---|---|
|执行时机|脚本编译阶段|游戏运行阶段|
|路径拼接|不支持变量拼接，只能写死字符串|支持动态拼接路径|
|卡顿|运行零卡顿|加载大资源主线程卡顿|
|报错时机|编辑器编译报错|游戏运行时报错|

### 4. 使用场景

✅ 角色皮肤切换、动态关卡、分支剧情资源、按需加载小型资源
❌ 禁止加载：超大贴图、长音频、复杂场景，必造成卡顿

## 四、异步加载 ResourceLoader（大型资源专用）

**核心作用**：后台子线程加载资源，不阻塞游戏画面，加载完成回调赋值，解决卡顿问题，Godot4 官方推荐加载大资源方案

### 1. 关键 API

- ResourceLoader.load_threaded()：开启异步加载
- ResourceLoader.get_load_thread_status()：查询加载状态
- 信号 resource_load_completed：加载完成回调

### 2. 标准完整版示例（场景 + 贴图，带加载进度）

```gdscript
extends Node3D

# 存储加载任务ID
var load_task_id: int = -1

func _ready():
    # 绑定全局资源加载完成信号
    ResourceLoader.resource_load_completed.connect(_on_resource_loaded)

    # 启动异步加载：加载巨型场景+高清贴图
    # 参数1：资源路径 参数2：资源类型 参数3：子线程加载
    load_task_id = ResourceLoader.load_threaded(
        "res://scenes/big_map.tscn",
        PackedScene,
        true
    )

    # 开启进度检测
    await _process_frame
    _check_load_progress()

# 轮询加载进度，更新UI进度条
func _check_load_progress() -> void:
    if load_task_id == -1:
        return
    # 获取加载状态：0加载中 1完成 2失败
    var status = ResourceLoader.get_load_thread_status(load_task_id)
    var progress = ResourceLoader.get_load_thread_progress(load_task_id)
    print("地图加载进度：", progress * 100, "%")

    match status:
        0:
            await _process_frame
            _check_load_progress()
        1:
            print("加载完成，等待回调")
        2:
            print("资源加载失败、路径错误")

# 资源加载完成回调
func _on_resource_loaded(path: String, res: Resource, error: int) -> void:
    if error != 0 or res == null:
        print("加载异常")
        return

    # 实例化加载完成的大场景
    if path == "res://scenes/big_map.tscn":
        var map_scene = res as PackedScene
        add_child(map_scene.instantiate())
```

### 3. 异步加载适用场景

- 超大地图场景、4K/8K 高清贴图
- 背景音乐、长音频、大体积粒子资源
- 游戏启动加载页、切换场景过渡页

## 五、附加高级加载方法

### 1. 加载外部本地资源（用户存档、外置图片）

读取用户目录资源，不能使用<res://，使用> <user://绝对路径>>

```gdscript
# 读取用户存档目录图片
var save_tex = load("user://save_texture.png")
```

### 2. 加载二进制资源、配置文件（JSON/TXT）

```gdscript
# 加载json配置
var json_res: FileAccess = load("res://config/setting.json")
var json_data = JSON.parse(json_res.get_as_text())
```

### 3. 资源缓存清理（防内存泄漏）

Godot 不会自动释放常驻缓存，不需要资源手动清空

```gdscript
# 清理指定资源缓存
ResourceCache.remove("res://textures/old_skin.png")
# 清空全部资源缓存
ResourceCache.clear()
```

### 4. 预加载屏蔽报错（可选）

部分可选资源，缺失不报错，返回空

```gdscript
# 第二个参数开启忽略缺失报错
var optional_sound = preload("res://sound/vip.wav", true)
```

## 六、四大加载方式横向对比

|加载方式|卡顿|动态路径|适用资源|
|---|---|---|---|
|静态加载（编辑器绑定）|启动卡顿|不支持|固定常驻资源|
|preload 预加载|运行零卡顿|不支持|预制体、UI、常驻音效|
|load 同步动态|小资源无感，大资源卡顿|支持|动态皮肤、分支小型资源|
|ResourceLoader 异步|无卡顿|支持|大地图、高清贴图、长音频|

## 七、工程强制最佳实践（避坑）

### 1. 编码规范

1. 所有**常驻、固定资源**：统一全局常量 + preload，禁止写 load
2. 所有**动态切换资源**：小资源用 load，大资源强制异步 ResourceLoader
3. 禁止在 _process/_physics_process 内部调用 load/preload，每帧加载极度耗性能
4. 资源路径全部写<res://，禁止本地绝对路径（打包发布失效）>

### 2. 高频致命坑

- **preload 不能拼接变量路径**：const A = preload("<res://"+name>) 直接报错！编译期无法识别变量
- load 加载不存在资源，返回 null，不会抛异常，不做空判断会闪退
- 异步加载不能立刻获取资源，必须等回调，读取过早返回空
- 场景切换不会清空 preload 缓存，重复加载会内存叠加，超大资源用完手动 clear

### 3. 项目目录规范

- scenes：场景文件、prefab 预制体
- resources：材质、动画、配置文件
- textures：贴图图集
- sounds：音效音频
