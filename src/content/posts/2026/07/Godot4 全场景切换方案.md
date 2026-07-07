---
title: Godot4 全场景切换方案
tags: [godot, godot/场景, godot/场景切换]
abbrlink: godot-scenario-switching
lang: zh
published: 2026-07-05
---

覆盖**单场景切换、多场景分层、异步加载过渡、后台预加载、多实例共存、加载进度条**全部方法，附带完整注释示例、适用场景、优缺点、踩坑点。

## 前置基础概念

1. **SceneTree**：场景树管理器，全局单例 `get_tree()`
2. **PackedScene**：打包场景资源（`.tscn`），实例化后加入树才会执行 `_ready`
3. 两种路径格式：
    - `res://xxx.tscn`：工程内置场景（打包可用）
    - `user://`：用户目录，一般不存场景
4. 核心区分：**替换根场景（全屏切换）** vs **叠加子场景（分层 UI / 副本）**

## 一、基础根场景替换（全屏切换，最常用）

直接替换整个游戏根节点，旧场景全部销毁，适合关卡切换、主菜单→游戏。

### 1. `get_tree().change_scene_to_file("路径")`

根据场景文件路径直接切换，最简单同步切换。

#### 示例代码

```gdscript
extends Button # 菜单按钮脚本

func _pressed():
    # 切换到游戏关卡场景，同步加载，大场景会卡顿
    get_tree().change_scene_to_file("res://scenes/level_01.tscn")
```

#### 特点

- 优点：一行代码，无需预加载资源
- 缺点：同步阻塞主线程，大场景加载画面卡死；无进度条
- 适用：小型小游戏、轻量场景切换

### 2. `get_tree().change_scene_to_packed(scene资源)`

传入预加载好的 `PackedScene` 对象切换，性能更好。

#### 示例

```gdscript
# 全局预加载关卡，编译期载入，切换零卡顿
const LEVEL1: PackedScene = preload("res://scenes/level_01.tscn")

func switch_level():
    get_tree().change_scene_to_packed(LEVEL1)
```

#### 特点

- 优点：资源提前预加载，切换瞬间完成，无卡顿
- 缺点：启动时就要加载所有关卡，占用内存；不能动态切换未知场景

### 3. 带参数传递：切换场景并传数据

场景切换后无法直接传变量，两种标准传参方案：

#### 方案 1：全局单例存数据（推荐）

```gdscript
# GameManager.gd 全局自动加载单例
var player_hp: int
var current_stage: int

# 切换前赋值
GameManager.current_stage = 1
get_tree().change_scene_to_file("res://scenes/level_01.tscn")

# 新场景_ready读取
func _ready():
    print("当前关卡：", GameManager.current_stage)
```

#### 方案 2：切换前临时创建全局节点传递（一次性数据）

```gdscript
# 创建临时数据节点，新场景读取后销毁
var data_node = Node()
data_node.set_name("TempData")
data_node.set_meta("hp", 80)
get_tree().root.add_child(data_node)

get_tree().change_scene_to_file("res://scenes/level_01.tscn")

# 新场景读取
func _ready():
    var temp_data = get_tree().root.get_node_or_null("TempData")
    if temp_data:
        var hp = temp_data.get_meta("hp")
        temp_data.queue_free() # 用完销毁
```

## 二、异步场景切换（带加载进度，解决卡顿，大型游戏必备）

`change_scene_to_file` 同步加载会卡死画面，使用 `ResourceLoader` 异步加载场景资源，配合过渡黑屏 / 进度条。

完整可运行模板（带进度 UI）：

```gdscript
extends Control # 加载界面脚本
@export var progress_bar: ProgressBar
var task_id: int = -1
var target_scene_path: String = "res://scenes/big_world.tscn"

func _ready():
    # 监听资源加载完成信号
    ResourceLoader.resource_load_completed.connect(_on_scene_loaded)
    # 开启子线程异步加载场景
    task_id = ResourceLoader.load_threaded(target_scene_path, PackedScene, true)
    await _process_frame
    _update_progress()

# 轮询更新加载进度条
func _update_progress():
    if task_id == -1: return
    var status = ResourceLoader.get_load_thread_status(task_id)
    var progress = ResourceLoader.get_load_thread_progress(task_id)
    progress_bar.value = progress * 100

    match status:
        0: # 加载中，继续循环
            await _process_frame
            _update_progress()
        1: # 加载完成，等待回调
            pass
        2: # 加载失败
            print("场景加载失败！")

# 资源加载完成回调，执行场景切换
func _on_scene_loaded(path: String, scene_res: Resource, err: int):
    if err != 0 or path != target_scene_path or scene_res == null:
        return
    # 替换根场景，进入新关卡
    get_tree().change_scene_to_packed(scene_res as PackedScene)
```

### 适用场景

超大地图、高清贴图、海量实体的大型关卡，游戏启动加载页。

## 三、叠加式场景（不销毁旧场景，分层共存）

不替换根场景，使用 `add_child()` 将场景实例作为子节点叠加，适合：UI 弹窗、副本、战斗场景、分层次关卡。

### 1. 基础叠加实例化

```gdscript
const UI_POPUP: PackedScene = preload("res://ui/shop_popup.tscn")

# 打开商店弹窗，原场景保留
func open_shop():
    var popup = UI_POPUP.instantiate()
    # 加到根节点，全屏覆盖UI
    get_tree().root.add_child(popup)

# 关闭弹窗（销毁叠加场景）
func close_shop(popup_node: Node):
    popup_node.queue_free()
```

### 2. 分层管理：持久父容器存放叠加场景

创建专用容器节点管理所有叠加场景，方便统一清空：

```gdscript
# 父节点为 SceneLayerManager（放根节点下）
var battle_layer: Node3D = $SceneLayerManager/BattleLayer

func enter_battle():
    var battle_scene = preload("res://scenes/battle.tscn").instantiate()
    battle_layer.add_child(battle_scene)

# 清空所有战斗内容
func exit_battle():
    battle_layer.queue_free_children()
```

#### 优缺点

✅ 优点：多场景同时存在，无需重新加载；切换无卡顿；可分层显示隐藏

❌ 缺点：旧场景常驻内存，内存占用持续升高；物理碰撞会跨层交互，需要层 mask 隔离

## 四、后台预加载场景（预加载 + 无缝切换）

提前在空闲时异步加载下一关资源，玩家切换时直接秒开，适合开放世界、连续关卡。

### 示例：后台预加载下一关

```gdscript
extends Node3D
var next_level_scene: PackedScene = null
var load_task: int = -1

func _ready():
    # 后台异步预加载下一关，不阻塞游戏
    load_task = ResourceLoader.load_threaded("res://scenes/level_02.tscn", PackedScene, true)
    ResourceLoader.resource_load_completed.connect(_preload_finish)

# 预加载完成缓存场景
func _preload_finish(path, res, err):
    if err == 0:
        next_level_scene = res as PackedScene
        print("下一关预加载完成，可无缝切换")

# 玩家触发切换关卡
func switch_next_level():
    if next_level_scene != null:
        get_tree().change_scene_to_packed(next_level_scene)
    else:
        # 预加载没完成，走同步加载兜底
        get_tree().change_scene_to_file("res://scenes/level_02.tscn")
```

## 五、多场景共存 + 显示隐藏（不销毁，复用）

实例化场景后不销毁，用 `visible` / `process_mode` 开关，适合频繁切换的 UI、小型副本。

```gdscript
const SHOP_SCENE: PackedScene = preload("res://ui/shop.tscn")
var shop_instance: Control

func _ready():
    # 提前实例化，默认隐藏
    shop_instance = SHOP_SCENE.instantiate()
    shop_instance.visible = false
    get_tree().root.add_child(shop_instance)

# 打开商店
func open_shop():
    shop_instance.visible = true
    shop_instance.process_mode = Node.PROCESS_MODE_INHERIT

# 关闭商店（不销毁，下次直接显示）
func close_shop():
    shop_instance.visible = false
    shop_instance.process_mode = Node.PROCESS_MODE_DISABLED # 停止逻辑节省性能
```

### 适用：频繁开关弹窗、背包、设置界面

## 六、场景切换专用辅助 API

### 1. `get_tree().reload_current_scene()` 重载当前场景

重启当前关卡，所有节点重新执行生命周期，用于重置关卡、失败重开。

```gdscript
func restart_level():
    get_tree().reload_current_scene()
```

### 2. 获取当前根场景路径

```gdscript
var current_path = get_tree().current_scene.resource_path
print("当前场景：", current_path)
```

### 3. 等待场景切换完成（await 异步等待）

切换场景是异步操作，可等待切换完成再执行逻辑：

```gdscript
func switch_and_do_something():
    get_tree().change_scene_to_file("res://level_02.tscn")
    await get_tree().scene_changed # 等待场景切换完成信号
    print("新场景加载完毕，执行初始化逻辑")
```

### 4. 监听全局场景切换事件

全局统一监听所有场景切换，做全局逻辑（音乐切换、存档）

```gdscript
# 全局GameManager脚本
func _enter_tree():
    get_tree().scene_changed.connect(_on_scene_switch)

func _on_scene_switch(new_scene: Node):
    print("切换到新场景：", new_scene.name)
    AudioServer.stop_all_streams() # 停止旧场景音乐
```

## 七、四种切换方案横向对比

|切换方式|旧场景销毁|是否卡顿|多场景共存|适用场景|
|---|---|---|---|---|
|change_scene_to_file（同步）|销毁|大场景卡顿|否|小型轻量关卡、菜单|
|change_scene_to_packed（预加载）|销毁|零卡顿|否|固定少量关卡|
|异步 ResourceLoader 切换|销毁|无卡顿，带进度|否|大型地图、加载页|
|add_child 叠加场景|保留|零卡顿|是|UI 弹窗、分层副本|
|隐藏复用场景|永久保留|零卡顿|是|频繁开关 UI|

## 八、高频踩坑与最佳实践

### 1. 内存泄漏必做规范

- 使用 `change_scene_to_*` 根切换：旧场景自动销毁，无需手动释放；
- `add_child` 叠加场景：退出时必须 `queue_free()`，否则永久占用内存；
- 全局信号绑定：所有子节点在 `_exit_tree()` 断开全局信号，切换场景不会残留报错。

### 2. 物理 / 碰撞跨层 bug

叠加多场景共存时，不同层级实体互相碰撞：

分层设置 `collision_layer` / `collision_mask`，UI 层、战斗层、背景层互相屏蔽。

### 3. 切换场景传参规范

禁止全局变量裸存数据，统一使用**自动加载单例**管理全局状态、玩家数据。

### 4. 加载卡顿解决方案

- 小型固定场景：`preload` 预加载 PackedScene；
- 大型动态场景：必须异步 `ResourceLoader` + 加载过渡 UI；
- 开放世界：后台空闲预加载下一关资源。

### 5. 切换黑屏过渡优化

切换前创建全屏黑色 ColorRect 叠加，场景加载完成后淡出，解决瞬间闪屏：

```gdscript
# 过渡黑屏脚本
func fade_out():
    var tween = create_tween()
    tween.tween_property(self, "modulate:a", 0, 0.5)
    await tween.finished
    queue_free()
```

## 九、完整标准切换流程（商业游戏通用模板）

1. 玩家触发切换事件；
2. 实例全屏过渡加载 UI；
3. 子线程异步加载目标场景资源，实时更新进度条；
4. 资源加载完成执行 `change_scene_to_packed`；
5. 等待 `scene_changed` 信号；
6. 新场景 `_ready()` 读取全局单例数据初始化；
7. 加载 UI 淡出销毁。
