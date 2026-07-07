---
title: Godot4 Layer & Mask 详解
tags: [godot, godot/layer, godot/mask]
abbrlink: godot-layer-and-mask
lang: zh
published: 2026-07-06
---

## 一、底层核心原理

Godot 物理系统提供**32 个独立物理层**，用**32 位二进制整数**存储 `collision_layer` / `collision_mask`，每一位对应 1 层（层 1 = 第 0 位，数值`1=2⁰`；层 2 = 第 1 位，数值`2=2¹`，以此类推）CSDN 博...。

### 1. 两个核心定义

#### ① Collision Layer（碰撞层）=「身份标签」

物体**自身属于哪些层**，相当于一张名片：**我是谁、我属于哪一类碰撞物体**。

- 一个物体可以同时勾选多个 Layer（用位或 `|` 叠加）
- 只有设置了 Layer，其他物体的 Mask 才能检测到你
- 默认所有物体 Layer = 1（仅第一层）

#### ② Collision Mask（碰撞掩码）=「检测过滤器」

物体**想要检测 / 碰撞哪些层**，相当于视线过滤：**我能看见谁、我会和谁发生交互**。

- Mask 为空 = 不检测任何物体，不会触发任何碰撞、Area 信号
- 默认所有物体 Mask = 1（只检测第一层）

### 2. 碰撞生效判定公式（关键）

A 与 B 产生碰撞 / 触发 Area 信号，**满足其一即可**：

```plaintext
(A.mask & B.layer) != 0  ||  (B.mask & A.layer) != 0
```

翻译：A 的视线能看到 B，**或者** B 的视线能看到 A，就会交互 Godot Engi...。

> 误区纠正：不需要双方互相勾选 Mask，单向即可生效。

### 3. 代码位运算基础

```gdscript
# 层1 = 1 << 0 = 1
# 层2 = 1 << 1 = 2
# 层3 = 1 << 2 = 4
# 层4 = 1 << 3 = 8

# 同时启用层1+层3
var layer_wall_player = 1 | 4
# 动态开关某一层
$Player.set_collision_mask_value(3, true) # 开启mask检测层3敌人
$Bullet.set_collision_layer_value(6, false) # 取消自身属于层6
```

## 二、Layer 和 Mask 分别有什么作用？

### 1. Collision Layer（身份）的全部用途

1. **被其他物体检测**：只有你挂了 Layer，别人 Mask 勾选你这一层才能碰到你
2. **射线 / 形状投射过滤**：RayCast2D/ShapeCast 的 `collision_mask` 只会匹配目标物体的 Layer
3. **Area 区域信号触发**：`body_entered` / `area_entered` 依赖对方 Layer 在自身 Mask 内
4. **物理碰撞阻挡**：角色、刚体穿墙、落地、击退全部依赖 Layer 标识

### 2. Collision Mask（视线）的全部用途

1. **过滤碰撞对象，减少无效物理计算**（核心性能优化点）
2. **控制交互逻辑隔离**：子弹只打敌人、不打友军；玩家不穿过道具
3. **Area 触发器精准监听**：传送门只检测玩家，忽略怪物
4. **射线只拾取指定层级**：鼠标点击只识别道具，忽略墙壁

### 3. 举个最简示例（平台跳跃）

- 地面：Layer=1 (环境)，Mask=0（不需要主动检测任何人，角色能撞墙是因为角色 Mask 包含环境层）
- 玩家：Layer=2 (玩家)，Mask=1|3（检测地面、敌人）
- 敌人：Layer=3 (敌人)，Mask=0（玩家能撞到敌人，敌人互相穿透）

## 三、不同节点的 Layer/Mask 使用区别

### 1. 实体物理体

- CharacterBody2D/3D、RigidBody、StaticBody
- Layer：标记自身身份（玩家 / 敌人 / 墙体）
- Mask：设置**需要碰撞阻挡的层级**（地面、敌人、子弹）
- 技巧：墙体、静态地面 Mask 直接设 0，节省物理计算

### 2. Area2D/Area3D

- 触发器、伤害判定、拾取区域
- Layer：可选，一般单独开一层 `trigger`，防止被物理体阻挡
- Mask：**核心配置**，只勾选需要监听的对象层（拾取道具只检测玩家层）
- 典型用法：伤害框 Mask = 玩家 / 敌人；传送门 Mask = 玩家

### 3. RayCast2D/ShapeCast

- 射线、扫描
- 自身 Layer 基本无用，**只看 Cast 的 collision_mask**
- mask 只勾选需要拾取的层：比如武器射线只检测敌人、环境

### 4. 粒子

- Particle2D/3D
- Layer：粒子所属层
- Mask：粒子碰撞检测范围，雨水 Mask 只勾选地面，穿透角色

## 四、行业通用分层规划（2D/3D 通用）

### 步骤 1：先给层命名

路径：`项目设置 → 层名称 → 2D物理 / 3D物理`，给每层写英文名称，避免记数字出错

![Godot Layer](https://cdn.ensoul.club/oAttachments/Images/2026/07/06/Godot_Layer.png)

### 标准分层分配

> 最多 8 层够用，大型项目不超 12 层

|层序号|数值|层名称|存放对象|
|---|---|---|---|
|1|1|world|地面、墙壁、静态障碍物、地形|
|2|2|player|玩家本体、玩家近战攻击框|
|3|4|enemy|敌人、怪物、敌方攻击框|
|4|8|item|金币、血包、可拾取道具|
|5|16|projectile|子弹、投射物、法术飞弹|
|6|32|hazard|尖刺、岩浆、持续伤害区域|
|7|64|trigger|传送门、剧情触发区、对话区域|
|8|128|friendly|NPC 友方、友军单位|

### 标准交互矩阵

1. **World（墙体）**
    Layer = 1，Mask = 0
    理由：不需要主动检测，所有动态物体 Mask 包含 World 即可碰撞地面
2. **Player（玩家）**
    Layer = 2，Mask = 1 | 3 | 4 | 5 | 6 | 7
    作用：撞墙、撞敌人、捡道具、吃子弹、踩尖刺、进传送门
3. **Enemy（敌人）**
    Layer = 3，Mask = 1 | 2 | 5 | 6
    作用：撞墙、被玩家碰撞、被子弹击中、踩尖刺；敌人之间互相穿透
4. **Bullet（子弹）**
    Layer = 5，Mask = 1 | 3
    作用：击中墙体消失、击中敌人造成伤害；不击中玩家、不捡道具
5. **Item（道具）**
    Layer = 4，Mask = 0
    作用：玩家 Mask 包含道具，玩家靠近拾取；道具不主动检测任何人
6. **Trigger（传送门）Area**
    Layer = 7，Mask = 2
    作用：只检测玩家进入，忽略敌人、子弹

## 五、官方 & 社区公认最佳实践

### 一、项目规范层面

1. **统一命名所有物理层，禁止裸数字配置**
    绝不靠记忆层 1 / 层 2，全部在项目设置命名，Inspector 可视化勾选，减少 bug。
2. **全局常量枚举管理层数值（大型项目必用）**
    创建全局脚本 `CollisionLayers.gd`，全程用常量替代数字，后期改分层只改一处：

	```gdscript
	# CollisionLayers.gd
	class_name CollisionLayers
	enum Layer {
		WORLD = 1,
		PLAYER = 2,
		ENEMY = 4,
		ITEM = 8,
		PROJECTILE = 16,
		HAZARD = 32,
		TRIGGER = 64
	}
	# 快速设置工具函数
	static func set_collision(target:CollisionObject2D, layer:int, mask:int):
		target.collision_layer = layer
		target.collision_mask = mask
	```

	使用：`CollisionLayers.set_collision($Player, CollisionLayers.PLAYER, CollisionLayers.WORLD | CollisionLayers.ENEMY)`

3. **分层越少越好，小型游戏控制在 6 层以内**
    分层越多维护成本越高，不要为细分而细分；粒子、特效共用一层即可。

### 二、性能优化最佳实践（重点）

1. **静态墙体、地形 Mask 全部设为 0**
    静态物体不需要主动检测其他物体，仅动态物体 Mask 包含 World 层就能碰撞，大幅减少物理检测对。
2. **子弹、投射物严格限制 Mask 范围**
    子弹 Mask 只勾选敌人 + 墙体，不要勾选玩家、道具，避免大量无效碰撞计算，弹幕游戏提升明显帧率。
3. **同类动态物体互相穿透（默认 Mask 不勾选自身层）**
    敌人之间、子弹之间默认不碰撞；需要单位互撞时再手动开启 Mask 自身层，减少 O (n²) 检测。
4. **Area 触发器 Mask 最小化**
    传送门、拾取区只勾选需要监听的层（如仅 Player），不要全选所有层。

### 三、逻辑隔离规范（解决常见 bug）

1. **友军 / 敌人完全隔离伤害**
    玩家子弹 Mask 只勾选 Enemy，不会误伤 NPC 友军；敌人子弹 Mask 只勾选 Player，不会自相残杀。
2. **拾取道具单向检测**
    道具 Mask=0，玩家 Mask 包含道具层；道具不会触发敌人拾取逻辑。
3. **伤害判定框独立分层**
    玩家近战攻击框 Layer=Player，敌人 Mask 包含 Player 即可收到伤害，不用额外配置。
4. **陷阱区域单独 Hazard 层**
    尖刺、岩浆统一一层，玩家 / 敌人 Mask 勾选该层统一扣血。

### 四、代码动态控制规范

1. 运行时开关交互，使用 `set_collision_mask_value(层号, bool)`，不要直接手动计算数值：

    ```gdscript
    # 玩家无敌时，关闭mask检测敌人、子弹
    func set_invincible(active:bool):
        $Player.set_collision_mask_value(3, !active) # enemy层
        $Player.set_collision_mask_value(5, !active) # projectile层
    ```

2. 射线拾取只写目标 Mask，减少多余物体检测：

    ```gdscript
    $RayCast.collision_mask = CollisionLayers.ENEMY | CollisionLayers.WORLD
    ```

## 六、高频踩坑与解决方案

1. **玩家穿不过道具 / 捡不到金币**
    原因：道具 Layer=4，但玩家 Mask 没有勾选 Item 层；或道具 Layer 为空。
    修复：玩家 Mask 添加 Item，道具设置 Layer=4。
2. **子弹穿过敌人不触发伤害**
    两种可能：
    - 子弹 Mask 没勾选 Enemy 层；
    - 敌人 Layer 未设置 Enemy。
        判定：子弹 Mask & 敌人 Layer 必须 > 0。
3. **Area 触发器完全没信号（body_entered 不触发）**
    Area 的 Mask 没有勾选目标物体的 Layer；或目标物体 Layer 为空。
4. **敌人互相挤在一起、卡顿**
    敌人 Mask 勾选了 Enemy 层，导致大量单位互撞；取消 Mask 自身层即可互相穿透。
5. **地面穿模、角色掉下去**
    地面 Layer=World，但玩家 Mask 没有勾选 World 层，角色无法识别墙体碰撞。

## 七、渲染层 / 导航层补充区分

> [!tip]
> 别和物理层混淆

Godot 除**2D/3D 物理层**外，还有独立两套分层，互不干扰：

1. **Render Layer（渲染层）**：控制物体是否被相机渲染、分层显示，和碰撞无关；
2. **Navigation Layer（导航层）**：NavigationAgent 寻路过滤，和物理碰撞 Layer 完全独立。

> 重要：物理层、渲染层、导航层三套系统完全隔离，配置互不影响。

## 八、极简落地流程

1. 打开项目设置，给 2D/3D 物理层命名；
2. 新建全局 `CollisionLayers` 枚举脚本，统一管理数值；
3. 按标准分层分配墙体、玩家、敌人、子弹、道具；
4. 静态物体 Mask 全部置 0；动态物体按需勾选 Mask；
5. Area 触发器只保留目标层 Mask；
6. 测试碰撞、拾取、子弹交互，按需微调分层。
