---
title: Firecracker 快照
description: Firecracker 官方快照文档的中文译文：创建与加载快照、差异快照、版本管理，以及快照的安全性与唯一性。
pubDate: 2026-11-12
tags: [AgentENV, Firecracker]
---

> [!NOTE]
>
> [Nitro Sandboxes](https://github.com/firecracker-microvm/firecracker/blob/main/docs/nitro-sandboxes/README.md) 不支持快照，因为它们没有暂停状态。

> 本文译自 Firecracker 官方文档
> [`docs/snapshotting/snapshot-support.md`](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md)。
> 代码、API 字段、命令和链接保持原样。对应 main 分支提交 778a26c。
> 原文采用 [Apache License 2.0](https://github.com/firecracker-microvm/firecracker/blob/main/LICENSE) 授权。

**目录**

- [什么是 microVM 快照？](#about-microvm-snapshotting)
- [Firecracker 中的快照](#snapshotting-in-firecracker)
  - [支持的平台](#supported-platforms)
  - [概述](#overview)
  - [快照文件管理](#snapshot-files-management)
  - [性能](#performance)
  - [开发预览状态](#developer-preview-status)
  - [限制](#limitations)
- [Firecracker 快照特性](#firecracker-snapshotting-characteristics)
- [快照版本管理](#snapshot-versioning)
- [快照 API](#snapshot-api)
  - [暂停 microVM](#pausing-the-microvm)
  - [创建快照](#creating-snapshots)
    - [创建完整快照](#creating-full-snapshots)
    - [创建差异快照](#creating-diff-snapshots)
    - [同步快照文件](#syncing-snapshot-files)
  - [恢复 microVM 运行](#resuming-the-microvm)
  - [加载快照](#loading-snapshots)
- [为快照预留宿主机磁盘空间](#provisioning-host-disk-space-for-snapshots)
- [确保克隆实例保持网络连通性](#ensure-continued-network-connectivity-for-clones)
- [快照的安全性与唯一性](#snapshot-security-and-uniqueness)
  - [使用示例](#usage-examples)
  - [安全地复用快照状态](#reusing-snapshotted-states-securely)
  - [加载快照的用户空间通知](#userspace-notifications-of-loading-snapshots)
- [Vsock 设备重置](#vsock-device-reset)
- [VMGenID 设备限制](#vmgenid-device-limitation)
- [可以在哪里恢复我的快照？](#where-can-i-resume-my-snapshots)

<a id="about-microvm-snapshotting"></a>
## 什么是 microVM 快照？

microVM 快照是一种机制：通过该机制，可以将运行中的 microVM 及其资源序列化，并以 `snapshot`（快照）的形式保存到外部介质。之后可以使用该快照，将 microVM 及其客户机工作负载恢复到该特定时间点。

<a id="snapshotting-in-firecracker"></a>
## Firecracker 中的快照

<a id="supported-platforms"></a>
### 支持的平台

Firecracker 快照功能支持 [README](https://github.com/firecracker-microvm/firecracker/blob/main/README.md#tested-platforms) 中列出的所有 CPU 微架构。

<a id="overview"></a>
### 概述

Firecracker microVM 快照可以在之后由另一个 Firecracker 进程加载，原始客户机工作负载会直接恢复运行。

创建快照所基于的原始客户机不应受到此过程的影响（快照创建过程引入的延迟除外）。

在另一个 Firecracker 进程中从快照恢复运行的客户机可能会出现网络和 vsock 数据包丢失。同时，也无法保证网络连接状态能在该进程中继续存在。此外，拍摄快照时处于打开状态的 vsock 连接会被关闭，但客户机中已有的 vsock 监听套接字仍保持活动，并可在恢复后接受新连接（参见 [Vsock 设备重置](#vsock-device-reset)）。

为了使恢复成为可能，Firecracker 快照会保存以下资源的完整状态：

- 客户机内存；
- 模拟硬件状态（包括 KVM 和 Firecracker 模拟的硬件）。

上述组件的状态是独立生成的，这为快照功能带来了灵活性。这意味着创建一次快照会生成多个文件，这些文件共同组成完整的 microVM 快照：

- 客户机内存文件；
- microVM 状态文件；
- 零个或多个磁盘文件（取决于客户机拥有的磁盘数量；这些文件**由用户管理**）。

该设计允许在多个 microVM 之间共享内存页和只读磁盘。加载快照时，Firecracker 不会在恢复运行时将文件的完整内容加载到内存，而是为内存文件创建一个
[MAP_PRIVATE 映射](http://man7.org/linux/man-pages/man2/mmap.2.html)，从而在运行时按需加载内存页。后续的任何内存写入都会进入写时复制的匿名内存映射。这样做可以显著加快快照加载速度，但代价是在恢复后的 microVM 整个生命周期内都必须保留客户机内存文件。

<a id="snapshot-files-management"></a>
### 快照文件管理

Firecracker 的快照设计提供了非常简单的快照操作接口，但不提供在宿主机上打包或管理快照的功能。

[威胁隔离模型](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md#threat-containment)指出，Firecracker 信任宿主机、宿主机/API 通信以及快照文件。

为了确保与快照功能的安全集成，用户需要实施身份验证和加密方案来保护快照文件，同时妥善管理其生命周期及跨越信任边界时的迁移，例如通过网络从仓库向宿主机提供快照文件时。

Firecracker 针对快速加载/恢复进行了优化，并且只对 VM 状态文件执行非常基础的正确性检查。它仅使用嵌入 VM 状态文件中的 64 位 CRC 值验证完整性，但这只是一种防止意外损坏的部分措施，磁盘文件和内存文件同样需要保护。需要注意的是，CRC 计算会在尝试加载快照之前进行验证。如果验证失败，系统会向用户显示错误，并终止 Firecracker 进程。

<a id="performance"></a>
### 性能

Firecracker 快照创建/恢复的性能取决于内存大小、vCPU 数量和模拟设备数量。Firecracker CI 会在所有[受支持的平台](https://github.com/firecracker-microvm/firecracker/blob/main/README.md#tested-platforms)上运行快照测试。

<a id="developer-preview-status"></a>
### 开发预览状态

差异快照仍处于开发预览阶段，我们正在深入研究该功能如何与 Firecracker 中的 guest_memfd 支持相结合。

<a id="limitations"></a>
### 限制

- 使用 cgroups V1 时，快照恢复延迟较高。我们强烈建议在启用 cgroups V2 的宿主机上部署快照，并使用相应的内核版本——参见[相关问题](https://github.com/firecracker-microvm/firecracker/issues/2129)。
- 恢复运行后，不保证客户机网络连接仍然保持。有关克隆实例网络连接的建议，请参见[克隆实例的网络连接](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/network-for-clones.md)。
- 在 arm64 上，快照功能适用于启用 GICv2 和 GICv3 的客户机。但是，无法在不同 GIC 版本之间恢复。
- 如果在 x86_64 上未使用 [CPU 模板](https://github.com/firecracker-microvm/firecracker/blob/main/docs/cpu_templates/cpu-templates.md)，则从快照恢复后，对 `MSR_IA32_TSX_CTRL` MSR 值的覆盖将不会保留。
- 从客户机内核启动早期阶段创建的快照恢复运行，可能会导致快照恢复时发生崩溃。我们建议用户在客户机 microVM 内核完成启动后再创建快照。请参见 [VMGenID 设备限制](#vmgenid-device-limitation)。

<a id="firecracker-snapshotting-characteristics"></a>
## Firecracker 快照特性

- 新建的 Firecracker microVM 使用匿名（`anonymous`）内存启动，而从快照恢复的 microVM 会从快照按需加载内存，并通过写时复制写入匿名内存。
- 从快照恢复针对速度进行了优化，而创建快照则需要消耗一些额外的 CPU 周期，以同步将内存页写入内存快照文件。创建 microVM 的完整快照会将客户机内存的全部内容写入快照，并且尤其会将所有客户机内存页调入（fault in）。
- *内存文件*和 *microVM 状态文件*由 Firecracker 在创建快照时生成。这些文件默认会执行 `fsync`（参见[同步快照文件](#syncing-snapshot-files)）；块设备后备文件始终会执行 `fsync` 并写入磁盘。
- 暴露快照功能的 API 调用都有明确的**前提条件（Prerequisites）**，说明应在何时以及如何使用它们。
- Firecracker microVM 的 MMDS 配置会包含在快照中。但是，数据存储不会跨快照持久化。
- 指标和日志的配置信息不会保存到快照中。需要在恢复后的 microVM 上重新配置这些信息。
- 在 x86_64 上，如果创建快照时某个 vCPU 的 `MSR_IA32_TSC_DEADLINE` 被设置为 0，Firecracker 会将其替换为同一 vCPU 的 `MSR_IA32_TSC` 值。这是为了确保即使创建快照时丢失了中断，该 vCPU 在从快照恢复后仍能继续接收 TSC 中断。

<a id="snapshot-versioning"></a>
## 快照版本管理

microVM 状态快照文件使用的数据格式版本形式为 `MAJOR.MINOR.PATCH`。每个 Firecracker 二进制文件都支持一个固定版本的快照数据格式。创建快照时，Firecracker 将使用其支持的数据格式版本。加载快照时，Firecracker 将检查快照版本是否与其支持的版本兼容。有关快照数据格式以及快照数据格式版本详细信息的更多内容，请参见[版本管理](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/versioning.md)。

<a id="snapshot-api"></a>
## 快照 API

Firecracker 提供以下用于操作快照的 API：`Pause`、`Resume` 和 `CreateSnapshot` 只能在 microVM 启动后调用，而 `LoadSnapshot` 只允许在启动前调用。

<a id="pausing-the-microvm"></a>
### 暂停 microVM

要创建快照，首先需要使用以下 API 命令暂停正在运行的 microVM 及其 vCPU：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PATCH 'http://localhost/vm' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d '{
            "state": "Paused"
    }'
```

**前提条件**：microVM 已启动。连续调用此请求会使 microVM 保持 `Paused` 状态。**效果**：

- _成功时_：保证 microVM 处于 `Paused` 状态。
- _失败时_：无副作用。

**`Paused` 的含义**：所有 vCPU 线程均已暂停，所有设备模拟均已停止。API 请求仍会被处理，但不会轮询任何 virtio 设备、tap、限速器或定时器（包括自动周期性刷新指标）。实际上，除内核在暂停后完成并由 `snapshot/create` 排空的异步块 I/O，以及外部 vhost-user 后端所做的更改外，客户机内存会被冻结在时间点上。

<a id="creating-snapshots"></a>
### 创建快照

> [!WARNING]
>
> 差异快照功能处于开发预览阶段。更多信息请参见[本节](#developer-preview-status)。

现在 microVM 已暂停，你可以创建快照。快照可以是 `full`（完整快照），也可以是 `diff`（差异快照）。完整快照始终会创建当前 microVM 状态和内存的完整、可恢复快照。差异快照会以稀疏文件形式至少保存当前 microVM 状态，以及自上一次快照（完整或差异快照）以来被访问的内存（由于 Firecracker 准确跟踪访问的能力存在技术限制，差异快照可能包含比严格所需更多的页）。差异快照通常无法直接恢复运行，而必须与基础快照合并成完整快照。例外情况是已启动 VM 的差异快照，它们可以立即恢复运行。在此上下文中，我们将基础快照称为由第一次 `/snapshot/create` API 调用创建的内存文件，而将层称为由后续 `/snapshot/create` API 调用创建的内存文件。快照的创建顺序很重要，合并时应按照与创建时相同的顺序进行。要将 `diff` 快照内存文件合并到基础快照之上，用户应将其内容复制到基础快照上。可以使用 Firecracker 发行版提供的 `rebase-snap`（已弃用）或 `snapshot-editor` 工具完成此操作：

```bash
snapshot-editor edit-memory rebase \
     --memory-path path/to/base \
     --diff-path path/to/layer
```

执行上述命令后，基础快照将成为一个可恢复的快照内存文件，描述创建该层时内存的状态。之后创建的更多层可以继续合并到这个基础快照之上。

需要对每一层重复此过程，直到描述所需内存状态的那一层被合并到基础快照之上；合并过程中，基础快照会不断用先前合并层的信息更新。请注意，用户不应合并由 `/snapshot/create` API 调用生成的状态文件，而应使用与最后合并到基础快照之上的内存文件在同一次调用中生成的状态文件。

<a id="creating-full-snapshots"></a>
#### 创建完整快照

要创建完整快照，可以使用以下 API 命令：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/create' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_type": "Full",
            "snapshot_path": "./snapshot_file",
            "mem_file_path": "./mem_file"
    }'
```

有关必填字段和可选字段的详细信息，请参见 [swagger 定义](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

> [!NOTE]
>
> 如果 `snapshot_path` 和 `mem_file_path` 指定的文件不存在，则会在生成快照之前创建它们。如果文件已存在，则会被截断并覆盖。

**前提条件**：microVM 处于 `Paused` 状态。

**效果**：

- _成功时_：

  - `snapshot_path` 指定的文件（例如 `/path/to/snapshot_file`）包含设备模型状态和模拟状态。`mem_file_path` 指定的文件（例如 `/path/to/mem_file`）包含客户机内存的完整副本。
  - 生成的快照文件立即可用（当前进程会释放其所有权）。此时，用户应在外部备份块设备后备文件。无论 `sync_snapshot_files` 设置如何，块设备后备文件都会在创建快照期间被排空并 `fsync` 到宿主机，因此其内容会写入底层持久化存储。
  - 如果启用了脏页跟踪，创建快照会重置脏页位图，并将所有页标记为干净（从脏页跟踪的角度来看）。

- _失败时_：无副作用。

**注意**：

- 快照中独立的块设备文件组件必须由用户处理。

<a id="creating-diff-snapshots"></a>
#### 创建差异快照

要创建差异快照，应使用相同的 API 命令，但将 `snapshot_type` 字段设置为 `Diff`。

> [!NOTE]
>
> 如果未指定，`snapshot_type` 默认为 `Full`。
>
> ```bash
> curl --unix-socket /tmp/firecracker.socket -i \
>     -X PUT 'http://localhost/snapshot/create' \
>     -H  'Accept: application/json' \
>     -H  'Content-Type: application/json' \
>     -d '{
>             "snapshot_type": "Diff",
>             "snapshot_path": "./snapshot_file",
>             "mem_file_path": "./mem_file"
>     }'
> ```

**前提条件**：microVM 处于 `Paused` 状态。

差异快照有两种模式。如果在配置 `/machine-config` 资源时，或通过 `/snapshot/load` 从快照恢复时，将 `track_dirty_pages` 设置为 `true`，Firecracker 将使用 KVM 的脏页日志运行时功能，确保差异快照只包含自启动/快照恢复以来被写入的页。如果未启用 `track_dirty_pages`，Firecracker 将使用 [`mincore(2)`][man mincore] 系统调用确定快照应包含哪些页。因此，这种快照模式仅在*禁用 swap 时*可用，因为 mincore 不会将从换出到 swap 的页视为“驻留在内存中（in core）”。这可能导致内存文件更大（尽管它们仍是稀疏文件），但避免了脏页日志记录的运行时开销。

> [!NOTE]
>
> 脏页跟踪会抵消[大页](https://github.com/firecracker-microvm/firecracker/blob/main/docs/hugepages.md#known-limitations)的大部分优势。

**效果**：

- _成功时_：
  - `snapshot_path` 指定的文件包含设备模型状态和模拟状态，与创建完整快照时相同。`mem_file_path` 指定的文件这次包含客户机内存的**差异副本**；该差异由自上次创建快照或自 microVM 创建以来被弄脏的内存页组成，以两个事件中较晚者为准。
  - **创建完整快照**一节中 **效果** 段落提到的所有其他效果在此同样适用。
- _失败时_：无副作用。

> [!NOTE]
>
> 以下是一个启用脏页跟踪的 API 命令示例：
>
> ```bash
> curl --unix-socket /tmp/firecracker.socket -i  \
>     -X PUT 'http://localhost/machine-config' \
>     -H 'Accept: application/json'            \
>     -H 'Content-Type: application/json'      \
>     -d '{
>             "vcpu_count": 2,
>             "mem_size_mib": 1024,
>             "smt": false,
>             "track_dirty_pages": true
>     }'
> ```

启用此支持也会启用 KVM 脏页跟踪，因此会产生成本（KVM 需要消耗 CPU 周期来记录被写入的页）；应仅在需要时使用。

创建快照会对当前运行的 microVM 产生一些轻微影响：

- vsock 设备会被[重置](#vsock-device-reset)，导致驱动程序在恢复运行时终止连接。
- 在 x86_64 上，会注入一个 KVM-clock 通知，以告知客户机它已被暂停。

<a id="syncing-snapshot-files"></a>
#### 同步快照文件

`PUT /snapshot/create` API 的可选字段 `sync_snapshot_files` 控制是否在请求返回前将快照状态文件和客户机内存文件同步（`fsync`）到磁盘。该设置适用于完整快照和差异快照，默认值为 `true`，可保证宿主机崩溃时的持久性。

将其设置为 `false` 会在不等待回写完成的情况下返回，从而加快快照创建速度。数据仍保留在宿主机页缓存中，因此同一宿主机上的读取仍能看到完整内容；只会失去跨宿主机崩溃的持久性。当不需要持久性时（例如后续流水线还会进一步转换快照），这一设置很有用。无论此设置如何，块设备后备文件始终会执行 `fsync`。

<a id="resuming-the-microvm"></a>
### 恢复 microVM 运行

可以通过发送以下 API 命令恢复 microVM：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PATCH 'http://localhost/vm' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d '{
            "state": "Resumed"
    }'
```

**前提条件**：microVM 处于 `Paused` 状态。连续调用此请求会被忽略（microVM 保持运行状态）。**效果**：

- _成功时_：保证 microVM 处于 `Resumed` 状态。
- _失败时_：无副作用。

<a id="loading-snapshots"></a>
### 加载快照

如果希望加载快照，只能在 microVM 配置**之前**进行（此前唯一可以配置的资源是日志记录器和指标系统），并发送以下 API 命令：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_path": "./snapshot_file",
            "mem_backend": {
                "backend_path": "./mem_file",
                "backend_type": "File"
            },
            "track_dirty_pages": true,
            "resume_vm": false
    }'
```

`backend_type` 字段表示用于加载快照的内存后端类型。可接受的值为：

- `File` - 依赖内核在将客户机内存文件内容加载到内存时处理缺页。
- `Uffd` - 使用专门的用户空间进程处理客户机内存范围的缺页。有关在用户空间处理缺页的更多细节，请参见[本文](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/handling-page-faults-on-snapshot-resume.md)。

`backend_path` 的含义取决于所选的 `backend_type`：

- 如果使用 `File`，则 `backend_path` 应包含要加载的快照内存文件路径。
- 使用 `Uffd` 时，`backend_path` 指用于 Firecracker 与处理缺页的用户空间进程之间通信的 Unix 域套接字路径。

`huge_pages` 字段选择恢复后的 microVM 要使用的宿主机页配置。它接受 `Snapshot`、`None`、`Transparent` 和 `2M`。`Snapshot` 会复用快照中存储的值，并且在省略该字段时作为默认值；`None` 使用宿主机默认的内存映射行为。显式指定 `2M` hugetlbfs 页需要 `Uffd` 后端，因此将 `2M` 与 `File` 结合使用会返回错误。使用 `Uffd` 时，透明大页的效果可能会受到限制。

当依赖操作系统处理缺页时，也可以接受以下命令。请注意，`mem_file_path` 字段目前受弃用策略约束。`mem_file_path` 和 `mem_backend` 互斥，因此同时指定两者会返回错误。

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_path": "./snapshot_file",
            "mem_file_path": "./mem_file",
            "track_dirty_pages": true,
            "resume_vm": false
    }'
```

有关必填字段和可选字段的详细信息，请参见 [swagger 定义](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

**前提条件**：**必须**提供完整内存快照和 microVM 状态文件。原先用于 microVM 配置的磁盘后备文件、网络接口对应的 TAP 设备，和/或 vsock 后备套接字，应已完成设置并且可由新的 Firecracker 进程（即恢复 microVM 的进程）访问。这些宿主机资源对于新 Firecracker 进程的相对路径，必须与它们对于原 Firecracker 进程的相对路径相同。

**效果：**

- _成功时_：
  - 完整的 microVM 状态会从快照加载到当前 Firecracker 进程。
  - 随后会重置脏页位图，并将所有页标记为干净（从差异快照的角度来看）。
  - 加载后的 microVM 现在处于 `Paused` 状态，因此需要恢复运行才能开始执行。
  - 内存文件（使用 `File` 后端类型时由 `backend_path` 指向，或由 `mem_file_path` 指向）**必须**被视为对 Firecracker 和宿主机均不可变。该文件通过页缓存为客户机操作系统内存的读取提供后备存储。外部修改此文件会破坏客户机内存，并导致未定义行为。
  - `snapshot_path` 指定且用于加载的文件会被释放，此进程不再使用它。
  - 如果设置了 `track_dirty_pages`，后续差异快照将基于 KVM 脏页跟踪。
  - 如果设置了 `resume_vm`，则加载成功后 VM 会自动恢复运行。
- _失败时_：会报告特定错误，然后终止当前 Firecracker 进程（因为它可能处于无效状态）。

*注意*：创建快照时不会保存 `track_dirty_pages` 配置，因此如果希望从已加载的 microVM 创建基于脏页跟踪的差异快照，必须在发送 `LoadSnapshot` 命令时再次显式设置 `track_dirty_pages`。

另外需要注意的是，从快照恢复的 microVM 在恢复运行时，客户机操作系统的墙上时钟会从创建快照的那一刻继续。因此，应在客户机侧将墙上时钟更新为当前时间。有关如何执行此操作的更多细节，请参见[相关 FAQ](https://github.com/firecracker-microvm/firecracker/blob/main/FAQ.md#my-guest-wall-clock-is-drifting-how-can-i-fix-it)。在 x86_64 上使用 `kvm-clock` 作为时钟源时，可以选择在 `LoadSnapshot` 请求中设置 `clock_realtime: true`，以便在恢复时推进客户机时钟（需要宿主机 Linux >= 5.16 才能支持此功能）。请注意，这可能会导致客户机内部出现问题，因为时钟看起来会突然跳变。创建快照的宿主机还必须使用基于 TSC 的时钟源（例如 `tsc`）。否则，KVM 不会在快照中保存实时时钟，而使用 `clock_realtime: true` 加载快照会失败，并返回 `clock_realtime requested but not present in the snapshot state`。

<a id="provisioning-host-disk-space-for-snapshots"></a>
## 为快照预留宿主机磁盘空间

根据 VM 内存大小的不同，快照可能消耗大量磁盘空间。Firecracker 集成方**必须**确保所预留的磁盘空间既足以支持服务的正常运行，也足以应对故障场景。如果服务向客户暴露快照触发功能，集成方**必须**实施适当的磁盘配额，以避免任何可能导致服务失败或运行异常的 DoS 威胁。

<a id="ensure-continued-network-connectivity-for-clones"></a>
## 确保克隆实例保持网络连通性

有关从单个 Firecracker microVM 快照创建多个克隆实例并保持网络连通性的建议，请参见[本文档](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/network-for-clones.md)。

<a id="snapshot-security-and-uniqueness"></a>
## 快照的安全性与唯一性

当快照的使用方式导致给定客户机的状态被恢复运行不止一次时，原本被认为唯一的信息实际上可能不再唯一；这些信息可能包括标识符、随机数和随机数种子、客户机操作系统熵池以及加密令牌。如果没有强健机制来保证唯一的内容在多次快照恢复之间仍保持唯一，我们认为从同一状态恢复执行多次是不安全的。

更多信息请参见[本文档](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/random-for-clones.md)。

<a id="usage-examples"></a>
### 使用示例

#### 示例 1：安全用法

```console
Boot microVM A -> ... -> Create snapshot S -> Terminate
                                           -> Load S in microVM B -> Resume -> ...
```

在此示例中，microVM A 在创建快照后终止，并且从未恢复工作；单个 microVM B 从快照 S 恢复执行。在这种情况下，本应只使用一次的唯一标识符、随机数和加密令牌确实只被使用了一次。在此示例中，我们认为 microVM B 是安全的。

#### 示例 2：可能不安全的用法

```console
Boot microVM A -> ... -> Create snapshot S -> Resume -> ...
                                           -> Load S in microVM B -> Resume -> ...
```

在此示例中，microVM A 和 B 都从快照 S 保存的状态开始工作。本应只使用一次的唯一标识符、随机数和加密令牌可能会被使用两次。无论 microVM A 是否在 microVM B 从快照 S 恢复执行之前终止，都没有影响。在此示例中，一旦 microVM A 恢复执行，我们就认为这两个 microVM 都不安全。

#### 示例 3：可能不安全的用法

```console
Boot microVM A -> ... -> Create snapshot S -> ...
                                           -> Load S in microVM B -> Resume -> ...
                                           -> Load S in microVM C -> Resume -> ...
                                           [...]
```

在此示例中，microVM B 和 C 都从快照 S 保存的状态开始工作。本应只使用一次的唯一标识符、随机数和加密令牌可能会被使用两次。无论 microVM B 和 C 在什么时间点恢复执行，也无论 microVM A 在创建快照后是否终止，都没有影响。在此示例中，我们认为 microVM B 和 C 不安全；如果 microVM A 恢复执行，我们也认为 microVM A 不安全。

<a id="reusing-snapshotted-states-securely"></a>
### 安全地复用快照状态

[虚拟机生成标识符](https://learn.microsoft.com/en-us/windows/win32/hyperv_v2/virtual-machine-generation-identifier)（Virtual Machine Generation Identifier，VMGenID）是一种虚拟设备，使 VM 客户机能够检测自己是否已从快照恢复。它通过向客户机暴露一个加密安全的随机 16 字节标识符来工作。VMM 确保每当 VM 生命周期中发生时间偏移事件（例如从快照恢复）时，标识符的值都会改变。

Linux 从 5.18 版本开始支持 VMGenID，适用于支持 ACPI 的系统。Linux 6.10 又增加了对使用 DeviceTree 而非 ACPI 的系统的支持。当 Linux 检测到标识符发生变化时，会使用其值重新播种（reseed）内部 PRNG。

Firecracker 在 x86 和 Aarch64 平台上都支持 VMGenID 设备。Firecracker 将始终启用该设备。在快照恢复期间，Firecracker 会在恢复 vCPU 之前更新 16 字节的生成 ID，并向客户机注入通知。

因此，运行 Linux 5.18 或更高版本的客户机将在快照恢复时重新播种其内核内 PRNG。用户空间应用程序可以依赖客户机内核提供随机性。除客户机内核熵池之外的其他状态，例如唯一标识符、缓存的随机数、加密令牌等，**仍会**在从同一快照恢复的多个 microVM 之间重复。用户需要在必要时实施机制，确保对此类状态进行去重。

<a id="userspace-notifications-of-loading-snapshots"></a>
## 加载快照的用户空间通知

VMClock 设备（[规范](https://uapi-group.org/specifications/specs/vmclock/)）是一种设备，使虚拟机内运行的应用程序能够高效地将其时钟与真实墙上时间同步。VMClock 还处理时钟发生某种干扰的情况。它通过 [`vmclock_abi`](https://uapi-group.org/specifications/specs/vmclock/#the-vmclock_abi-structure) 中的字段来处理这些情况。目前，它处理两种情况：

1. 通过 `disruption_marker` 字段处理实时迁移。
1. 通过 `vm_generation_counter` 处理从快照恢复。

每当 VM 从快照启动时，VMClock 都会在 `vm_generation_counter` 中呈现一个新值（不同于先前存储的值）。这一过程以原子方式发生，即一旦快照加载后 vCPU 恢复运行，`vm_generation_counter` 就会包含新值。

用户空间库（例如用户空间 PRNG）可以对 `vmclock_abi` 执行 mmap()，并监视 `vm_generation_counter` 的变化，以判断何时需要调整和/或重新创建状态。

此外，VMClock 允许进程对 VMClock 设备调用 poll()，并通过事件循环获得变更通知。

作为参考，我们测试中使用的 C 代码可在[此处](https://github.com/firecracker-microvm/firecracker/blob/main/tests/host_tools/vmclock.c)获取。

> [!IMPORTANT]
>
> Linux 中对 `vm_generation_counter` 和 `poll()` 的支持由[此处](https://lore.kernel.org/all/20260130173704.12575-1-itazur@amazon.com/)的补丁实现，并已合并到 Linux 内核 v7.0。用户需要确保其内核已应用链接中的补丁。这些补丁已向后移植到 Amazon Linux v5.10 和 v6.1 microVM 内核，起始版本分别为
> [microvm-kernel-5.10.252-285.992.amzn2](https://github.com/amazonlinux/linux/tree/microvm-kernel-5.10.252-285.992.amzn2) 和
> [microvm-kernel-6.1.167-27.319.amzn2023](https://github.com/amazonlinux/linux/tree/microvm-kernel-6.1.167-27.319.amzn2023)。
> 运行集成测试套件时会自动下载这些打过补丁的内核，也可以使用 `tools/devtool download_ci_artifacts` 手动下载。

<a id="vsock-device-reset"></a>
## Vsock 设备重置

vsock 设备在快照/恢复过程中会被重置，以避免设备与驱动程序之间的状态不一致导致故障（[#2218](https://github.com/firecracker-microvm/firecracker/issues/2218)）。具体做法是在 `SnapshotCreate` 期间向客户机驱动程序发送 `VIRTIO_VSOCK_EVENT_TRANSPORT_RESET` 事件（[#2562](https://github.com/firecracker-microvm/firecracker/pull/2562)）。在 `SnapshotResume` 时，当 VM 再次变为活动状态，vsock 驱动程序会关闭所有现有连接。现有监听套接字仍保持活动，但其 CID 会更新为反映当前的 `guest_cid`。有关此事件的更多细节，请参见[此处](https://docs.oasis-open.org/virtio/virtio/v1.1/csprd01/virtio-v1.1-csprd01.html#x1-4080006)的 Virtio 官方文档。

<a id="vmgenid-device-limitation"></a>
## VMGenID 设备限制

在快照恢复期间，Firecracker 会在恢复 vCPU 之前更新 VMGenID 设备的 16 字节生成 ID，并向客户机注入中断。如果快照是在客户机内核启动过程的极早期阶段拍摄的，正确的中断处理可能尚未就绪。因此，内核可能无法处理注入的通知并崩溃。我们建议用户仅在客户机内核完成启动后创建快照，以避免此问题。

<a id="where-can-i-resume-my-snapshots"></a>
## 可以在哪里恢复我的快照？

快照必须在其生成时完全相同的软件和硬件配置上恢复。不过，在有限的情况下，快照可以在拍摄时所用硬件的同类型实例上使用更新的宿主机内核版本恢复。虽然我们不对此类配置提供任何保证（也不建议在生产环境中这样做），但目前已知以下兼容性关系：

| 裸金属实例类型 | 创建快照时的宿主机内核 | 恢复时使用的宿主机内核 |
| -------------------- | -------------------- | ----------------------- |
| {m5n,m6i,m6a}        | 5.10                 | 6.1                     |

例如，在运行 5.10 宿主机内核的 m6i.metal 宿主机（Intel Ice Lake）上创建的快照，可以在另一台运行 6.1 宿主机内核的 m6i.metal 宿主机上恢复（但反过来不行），但不能在 m5n.metal 宿主机（Intel Cascade Lake）上恢复。

[man mincore]: https://man7.org/linux/man-pages/man2/mincore.2.html
