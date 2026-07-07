---
title: Godot4 生命周期与通知
tags: [godot, godot/生命周期, godot/通知, godot/notification]
published: 2026-07-04
abbrlink: godot-lifecycle-notification
lang: zh
---

分为两大部分：
**内置生命周期虚函数（`_init/_ready/_process` 等）**
**通用节点通知 `_notification()` + 全部 NOTIFICATION 常量**，附带触发时机、使用场景、坑点、最佳实践。

## 一、核心前置概念

1. **生命周期函数**：GDScript 自动调用的预留虚方法，无需手动绑定，引擎自动按节点树加载 / 运行时序执行。
2. **通知 Notification**：引擎向节点发送整数信号，统一在 `_notification(what)` 接收，覆盖节点树挂载、父子变更、窗口、物理、渲染、销毁等全事件；所有生命周期函数本质是引擎内部封装了对应通知。
3. 执行顺序总览（新建节点→加载→运行→销毁）：
$1
    `_init` → NOTIFICATION_ENTER_TREE(`_enter_tree`) → NOTIFICATION_READY(`_ready`) → 帧循环 (`_process/_physics_process`) → 退出树 → 销毁

## 第一部分：内置生命周期虚函数（全部官方标准方法）

### 1. `_init()`

#### 触发时机

脚本实例**刚被创建、还未挂载到任何节点树**时执行，构造函数。

- 场景编辑器预加载节点、动态 `new()` 创建脚本都会触发；
- 此时节点**还没有父节点、未进入场景树、节点属性未加载完成**。

#### 可用场景

1. 初始化纯脚本常量、内部变量、预定义枚举；
2. 创建无依赖的基础数据结构（数组、字典、缓存池）；
3. 定义全局默认配置，不访问节点树、不读取外部节点属性。

#### 禁止操作（高频踩坑）

- 不能用 `$路径`、`get_parent()`、`get_node()`、`global_position`；
- 不能修改子节点、父节点、动画、碰撞层；
- 不能加载资源、实例化场景（资源管理器未就绪）。

#### 示例

```gdscript
var hp_max: int
func _init():
    hp_max = 100
    var skill_list = ["jump", "attack"]
```

### 2. `_enter_tree()`

对应通知：`NOTIFICATION_ENTER_TREE`

#### 触发时机

节点**成功挂载到场景树（SceneTree）** 的瞬间：

- 场景实例化加载完成、节点被 `add_child()` 添加进父节点；
- 此时已有父节点、可 `get_parent()`，但**节点资源 / 子节点还未全部加载完毕**，`_ready` 还没执行。

#### 可用场景

1. 注册全局单例、全局信号绑定（如监听全局输入、游戏管理器事件）；
2. 向全局管理器注册自身实例（玩家、敌人注册进怪物管理器）；
3. 提前获取父节点引用、缓存父节点变量；
4. 动态监听场景树全局事件。

#### 限制

子节点可能还未加载完成，`$子节点` 大概率返回 null，不要访问子节点。

#### 示例

```gdscript
var parent_mgr: Node3D
func _enter_tree():
    parent_mgr = get_parent()
    GameManager.player_register(self)
    GameManager.connect("game_pause", _on_game_pause)
```

### 3. `_ready()`

对应通知：`NOTIFICATION_READY`

#### 触发时机

节点**自身 + 所有子节点全部加载完成、资源解析完毕、进入场景树后**最后一步初始化回调。

**90% 游戏初始化逻辑写在这里**。

#### 可用场景

1. 缓存子节点引用：`$CollisionShape3D`、`$Pivot`、动画播放器、射线检测；
2. 读取导出变量、配置参数、初始化动画、碰撞层、遮罩；
3. 绑定子节点本地信号（`$MobDetector.body_entered.connect(_on_mob_found)`）；
4. 生成初始道具、初始化 AI 状态机、相机跟随配置；
5. 加载本地贴图、音效等绑定到节点的资源。

#### 优势

此时全节点树就绪，`$路径`、`get_child()`、`global_position` 全部可用。

#### 示例

```gdscript
@export float move_speed = 5.0
var pivot: Node3D
func _ready():
    pivot = $Pivot
    $MobDetector.body_entered.connect(_on_mob_detected)
    collision_mask = 1 | 4
```

### 4. `_process(delta: float)`

对应通知：`NOTIFICATION_PROCESS`

#### 触发时机

**渲染帧循环**，每渲染一帧执行一次，帧率不固定（屏幕刷新率 60/144 帧）。

参数 `delta`：距离上一帧的时间（秒），用于帧速率无关平滑计算。

#### 适用场景

1. 视觉、动画、相机插值、UI 渲染、画面平滑旋转；
2. 输入检测、鼠标 / 键盘操作（移动方向采集）；
3. 粒子特效、材质渐变、UI 文字更新；
4. 相机跟随、模型平滑旋转插值（你的 Pivot 平滑转向）。

#### 不推荐

物理移动、重力、碰撞检测（帧率波动会导致移动速度忽快忽慢）。

### 5. `_physics_process(delta: float)`

对应通知：`NOTIFICATION_PHYSICS_PROCESS`

#### 触发时机

**固定物理步进**，默认每秒 60 次，间隔恒定 `delta=1/60`，不受屏幕帧率影响。

#### 适用场景（物理相关唯一标准位置）

1. `CharacterBody2D/3D` 角色移动、`move_and_slide()`；
2. 重力、速度、加速度、刚体力施加；
3. 碰撞检测、射线投射、怪物 AI 寻路；
4. 所有需要稳定物理计算的逻辑（你的角色移动代码）。

#### 强制规范

角色移动、碰撞、物理逻辑**全部写这里**，不要放 `_process`。

### 6. `_input(event: InputEvent)`

对应通知：`NOTIFICATION_INPUT`

#### 触发时机

每次硬件输入事件（按键按下 / 松开、鼠标移动、手柄摇杆）触发。

#### 适用场景

1. 一次性按键触发（跳跃、攻击、技能释放，而非持续移动）；
2. 鼠标点击、右键交互、手柄按键；
3. 区分按下 / 松开状态，处理单次触发动作。

#### 区分 _process 输入检测

- `_input`：事件触发一次，适合瞬发技能；
- `_process`：持续检测 `Input.is_action_pressed`，适合持续移动。

### 7. `_unhandled_input(event: InputEvent)`

对应通知：`NOTIFICATION_UNHANDLED_INPUT`

#### 触发时机

输入事件没有被任何 UI 控件、输入捕获节点消费时才执行。

#### 适用场景

全局快捷键、游戏全局暂停、ESC 打开菜单，不被 UI 遮挡。

### 8. `_exit_tree()`

对应通知：`NOTIFICATION_EXIT_TREE`

#### 触发时机

节点从场景树移除瞬间（`queue_free()`、`remove_child()`、场景切换）。

#### 适用场景

1. 解绑全局信号，防止内存泄漏（关键！）；
2. 从全局管理器注销自身；
3. 停止计时器、动画、循环协程；
4. 释放手动创建的资源、移除单例引用。

#### 必做规范

所有在 `_enter_tree` 绑定的全局信号，必须在 `_exit_tree` disconnect，否则场景销毁后残留信号报错。

### 9. `_process_frame_post_draw()` / `_process_frame_pre_draw()`（渲染回调）

#### 触发时机

渲染管线前后执行，仅 2D / 自定义绘制使用。

- `pre_draw`：绘制前修改材质、画布；
- `post_draw`：绘制后叠加自定义图形、后处理。

### 10. `_notification(what: int)`

统一接收所有底层引擎通知的总入口，所有上面的生命周期函数本质是引擎对特定 what 值的封装。

下面完整列出全部常用通知常量、触发时机、使用场景。

## 第二部分：全量 Notification 通知大全（NOTIFICATION_*）

在脚本中统一接收：

```gdscript
func _notification(what: int):
    match what:
        NOTIFICATION_PARENTED:
            print("节点获得父节点")
        NOTIFICATION_UNPARENTED:
            print("节点失去父节点")
        NOTIFICATION_ENTER_TREE:
            print("进入场景树，对应_enter_tree")
        NOTIFICATION_READY:
            print("全部加载完成，对应_ready")
```

### 一、节点树父子关系通知

#### 1. NOTIFICATION_PARENTED

触发：节点被 `add_child()` 附加到父节点，**早于 _enter_tree**

场景：动态获取父节点、监听父节点变更、缓存父组件。

#### 2. NOTIFICATION_UNPARENTED

触发：节点被 `remove_child()`、父节点销毁、场景切换失去父节点

场景：清空父节点缓存、解绑父节点信号。

#### 3. NOTIFICATION_ENTER_TREE

等价 `_enter_tree()`，节点加入场景树。

#### 4. NOTIFICATION_EXIT_TREE

等价 `_exit_tree()`，节点离开场景树。

### 二、加载就绪通知

#### 5. NOTIFICATION_READY

等价 `_ready()`，节点 + 所有子节点加载完毕。

### 三、帧循环更新通知

#### 6. NOTIFICATION_PROCESS

每渲染帧执行，对应 `_process(delta)`。

#### 7. NOTIFICATION_PHYSICS_PROCESS

固定物理帧执行，对应 `_physics_process(delta)`。

### 四、输入通知

#### 8. NOTIFICATION_INPUT

对应 `_input(event)`，接收所有输入事件。

#### 9. NOTIFICATION_UNHANDLED_INPUT

对应 `_unhandled_input(event)`，未被 UI 捕获的输入。

#### 10. NOTIFICATION_INPUT_MOUSE

鼠标单独通知，底层鼠标事件。

### 五、可见 / 渲染通知

#### 11. NOTIFICATION_VISIBILITY_CHANGED

节点 `visible` 属性切换时触发

场景：物体显隐切换时关闭 / 开启碰撞、暂停粒子。

#### 12. NOTIFICATION_DRAW

2D 节点自定义绘制回调（`draw_line/draw_texture`）。

### 六、窗口 / 游戏生命周期通知（全局通用）

#### 13. NOTIFICATION_WINDOW_FOCUS_IN

游戏窗口获得鼠标焦点（切回游戏）

场景：解除游戏暂停、恢复背景音乐。

#### 14. NOTIFICATION_WINDOW_FOCUS_OUT

窗口失去焦点（切桌面、切浏览器）

场景：自动暂停游戏、降低音效音量。

#### 15. NOTIFICATION_WINDOW_RESIZED

窗口分辨率 / 窗口大小修改

场景：UI 自适应布局、相机视野适配。

#### 16. NOTIFICATION_WINDOW_CLOSE_REQUEST

玩家点击窗口关闭按钮

场景：弹出退出确认弹窗，拦截直接关闭。

### 七、物理 / 碰撞相关通知

#### 17. NOTIFICATION_PHYSICS_COLLISION

刚体发生碰撞时底层通知（替代部分 Area 信号）

#### 18. NOTIFICATION_BODY_ENTERED / NOTIFICATION_AREA_ENTERED

Area 检测到物体进入底层通知（等价 body_entered 信号）

### 八、销毁 / 内存释放通知

#### 19. NOTIFICATION_PREDELETE

节点执行 `queue_free()` 销毁前最后一次通知，**销毁前最后执行逻辑**

场景：终极资源释放、存档、保存临时数据、彻底清理缓存。

#### 20. NOTIFICATION_DELETED

节点内存被释放，脚本已失效，**禁止读写任何节点属性**，仅做日志打印。

### 九、父子层级变更补充通知

#### 21. NOTIFICATION_MOVED_IN_PARENT

节点在父节点内部排序变更（调整层级顺序）

场景：UI 层级切换、渲染顺序变更检测。

### 十、时间 / 计时器通知

#### 22. NOTIFICATION_TIMER_TIMEOUT

Timer 节点计时结束底层通知。

## 第三部分：生命周期完整执行时序演示

### 场景 1：编辑器实例化节点（游戏启动加载场景）

1. `_init()` 脚本构造
2. `NOTIFICATION_PARENTED` 绑定父节点
3. `NOTIFICATION_ENTER_TREE` → `_enter_tree()`
4. 所有子节点递归加载完成
5. `NOTIFICATION_READY` → `_ready()`
6. 进入循环：`NOTIFICATION_PROCESS(_process)` / `NOTIFICATION_PHYSICS_PROCESS(_physics_process)`
7. 切换场景 / 调用 queue_free ()
8. `NOTIFICATION_EXIT_TREE` → `_exit_tree()`
9. `NOTIFICATION_PREDELETE` 销毁前回调
10. `NOTIFICATION_DELETED` 内存释放

### 场景 2：代码动态创建节点 `var player = Player.new(); add_child(player)`

1. `_init()`
2. `add_child()` 触发 `NOTIFICATION_PARENTED`
3. 加入场景树 `NOTIFICATION_ENTER_TREE` → `_enter_tree()`
4. 子节点加载完成执行 `_ready()`

### 场景 3：节点从父节点移除 `remove_child(player)`

1. `NOTIFICATION_UNPARENTED`
2. `NOTIFICATION_EXIT_TREE` → `_exit_tree()`

## 第四部分：分场景最佳实践规范

### 1. 角色 / 物理实体（CharacterBody3D、你的 Player）

1. `_init`：仅定义基础数值；
2. `_enter_tree`：注册进全局游戏管理器、绑定全局暂停信号；
3. `_ready`：缓存 Pivot、碰撞形状、探测 Area、绑定本地碰撞信号；
4. `_process`：Pivot 平滑旋转插值、相机跟随、UI 血量更新；
5. `_physics_process`：移动输入、move_and_slide、重力、射线检测；
6. `_input`：跳跃、攻击、技能单次按键；
7. `_exit_tree`：注销全局管理器、断开所有全局信号；
8. `NOTIFICATION_WINDOW_FOCUS_OUT`：玩家切桌面时停止移动。

### 2. Area 触发器（MobDetector 探测区域）

1. `_ready`：绑定 `body_entered` 信号；
2. `NOTIFICATION_VISIBILITY_CHANGED`：隐藏时关闭碰撞层；
3. `_exit_tree`：断开探测信号防止内存泄漏。

### 3. UI 面板、菜单

1. `_input_unhandled`：ESC 关闭菜单；
2. `NOTIFICATION_WINDOW_RESIZED`：自适应布局；
3. `NOTIFICATION_WINDOW_CLOSE_REQUEST`：拦截关闭，弹出确认框。

### 4. 全局管理器单例

1. `_enter_tree`：监听窗口焦点、全局输入；
2. `NOTIFICATION_WINDOW_FOCUS_IN/OUT`：全局暂停 / 恢复游戏；
3. `NOTIFICATION_PREDELETE`：自动保存游戏进度。

## 第五部分：高频踩坑总结

1. **`_init` 访问子节点报错**：节点还未挂载，改用 `_ready`；
2. **全局信号忘记在 `_exit_tree` 断开**：场景销毁后残留信号，下一次加载疯狂报错；
3. **物理移动写在 `_process`**：帧率波动导致角色速度忽快忽慢，必须放 `_physics_process`；
4. **销毁时读写节点属性**：`NOTIFICATION_DELETED` 节点已失效，逻辑写 `NOTIFICATION_PREDELETE`；
5. **混淆 PARENTED / ENTER_TREE**：PARENTED 仅代表有父，ENTER_TREE 代表完整进入场景树；
6. 在 `_ready` 中动态 `add_child` 新节点：新节点会完整走一遍 `_init→enter_tree→ready`，不会阻塞当前脚本。

## 第六部分：通用标准模板（可直接复制使用）

```gdscript
extends CharacterBody3D

# 构造函数
func _init():
    pass

# 进入场景树
func _enter_tree():
    pass

# 加载完成初始化
func _ready():
    pass

# 渲染帧更新（视觉、相机、平滑插值）
func _process(delta: float) -> void:
    pass

# 固定物理帧（移动、碰撞、重力）
func _physics_process(delta: float) -> void:
    pass

# 单次按键、鼠标输入
func _input(event: InputEvent) -> void:
    pass

# 失去焦点、退出树清理资源
func _exit_tree():
    pass

# 统一捕获底层通知
func _notification(what: int):
    match what:
        NOTIFICATION_PARENTED:
            print("获得父节点")
        NOTIFICATION_UNPARENTED:
            print("失去父节点")
        NOTIFICATION_WINDOW_FOCUS_OUT:
            print("窗口切出，暂停游戏")
        NOTIFICATION_PREDELETE:
            print("即将销毁，保存数据")
```
