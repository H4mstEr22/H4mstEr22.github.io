---
title: 处理快照内存加载
description: Firecracker 官方文档的中文译文：从快照恢复时，由内核处理缺页，还是借助 Userfaultfd 交给用户空间的缺页处理程序。
pubDate: 2026-11-12T12:00:00+08:00
tags: [AgentENV, Firecracker]
---

> 本文译自 Firecracker 官方文档
> [`docs/snapshotting/handling-page-faults-on-snapshot-resume.md`](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/handling-page-faults-on-snapshot-resume.md)。
> 代码、API 字段、命令和链接保持原样。对应 main 分支提交 778a26c。
> 原文采用 [Apache License 2.0](https://github.com/firecracker-microvm/firecracker/blob/main/LICENSE) 授权。

Firecracker 让用户能够更好地管理 microVM 的内存加载：从快照恢复运行时，用户可以选择依赖宿主机操作系统处理缺页，也可以借助 [Userfaultfd](https://www.kernel.org/doc/html/v4.18/admin-guide/mm/userfaultfd.html)，由专门的用户空间进程处理缺页。

## 内核

从快照恢复 microVM 时，将快照中客户机的内存（以文件为后备）加载到 RAM 通常由内核负责，并且按每次缺页逐页处理。每当客户机访问一个尚未存在于 Firecracker 进程内存中的页时，就会发生一次缺页，从而触发上下文切换和 IO 操作，将该页调入 RAM。视使用场景而定，对每个页都这样处理可能会很耗时。

## Userfaultfd

Userfaultfd 是一种将处理缺页事件的职责从内核空间转交给用户空间的机制。为了能够与该机制交互，用户空间首先需要获取一个 userfault 文件描述符对象（UFFD）。

### 创建 UFFD 对象

#### 内核 5.10

对于 5.10 宿主机内核，UFFD 对象通过调用 [`userfaultfd` 系统调用](https://man7.org/linux/man-pages/man2/userfaultfd.2.html)创建。

#### 内核 6.1

对于 6.1 内核，UFFD 通过 `/dev/userfaultfd` 设备创建。对 `/dev/userfaultfd` 的访问由文件系统权限管理，因此 Firecracker 进程需要具备相应权限才能创建 UFFD 对象。当宿主机系统中存在 `/dev/userfaultfd` 时，jailer 会使其在 jail 内可用，Firecracker 进程无需任何额外配置即可使用它。

如果用户没有将 Firecracker 与 jailer 一起使用，则需要手动管理 `/dev/userfaultfd` 的权限。例如，在依赖访问控制列表（ACL）的系统上，可以这样做：

```bash
sudo setfacl -m u:${USER}:rw /dev/userfaultfd
```

### 通过 Userfault 文件描述符注册要处理的内存

接下来，必须将内存地址范围注册到 userfault 文件描述符，使 userfault 对象能够监视这些地址上发生的缺页。此后，用户空间进程就可以开始通过 userfault 文件描述符读取并处理事件。这些事件会包含触发缺页的地址。缺页处理线程可以使用这些[操作](https://www.kernel.org/doc/html/latest/admin-guide/mm/userfaultfd.html#resolving-userfaults)来处理事件。

在上述流程中，有两个用户空间进程相互交互以处理缺页：Firecracker 进程和缺页处理程序。请注意，用户需要自行编写缺页处理程序进程，用于监视 userfaultfd 事件并处理这些事件。

下面是 Firecracker 与（由用户设计的）缺页处理程序之间的交互流程：

- 缺页处理程序绑定并监听一个 Unix 域套接字（UDS），以便与 Firecracker 进程通信。

![交互流程 1：缺页处理程序绑定并监听 UDS](/images/docs/firecracker/uffd_flow1.png)

请注意，使用 Jailer 时，缺页处理程序进程、UDS 和内存文件都必须位于 jail 内。UDS 必须只能由 Firecracker 和缺页处理程序访问。

- 向 Firecracker 的 API 线程发出 PUT snapshot/load API 调用。请求体中包含缺页处理程序所监听的 Unix 域套接字路径，用于与 Firecracker 通信。
- Firecracker 进程创建 userfault 对象，并获取 userfault 文件描述符。
- 缺页处理程序以私有方式 mmap 客户机内存文件的内容。

![交互流程 2：Firecracker 创建 UFFD，缺页处理程序 mmap 内存文件](/images/docs/firecracker/uffd_flow2.png)

- Firecracker 根据 microVM 状态文件中的内存描述以匿名方式 mmap 内存，并将这些内存区域注册到 userfault 对象，使 userfaultfd 能够感知这些地址上的缺页事件。随后，Firecracker 连接到缺页处理进程先前打开的套接字。

![交互流程 3：Firecracker 匿名映射内存并连接 UDS](/images/docs/firecracker/uffd_flow3.png)

- Firecracker 通过该套接字，将 userfault 文件描述符和客户机内存布局（例如每个内存区域的大小及其以 KiB 为单位的[页大小](https://github.com/firecracker-microvm/firecracker/blob/main/docs/hugepages.md)）传递给缺页处理程序进程。

![交互流程 4：Firecracker 通过 UDS 发送 UFFD 和内存布局](/images/docs/firecracker/uffd_flow4.png)

- 向缺页处理程序发送必要信息后，Firecracker 继续执行从快照恢复的正常流程：从 microVM 状态文件中读取相关的序列化组件，并将其加载到内存中。

- Firecracker 访问客户机内存时发生的缺页，由缺页处理程序进程处理；该进程监听 Firecracker 先前发送的 userfault 文件描述符上的事件。发生缺页事件时，缺页处理程序会执行 `UFFDIO_COPY`，将先前 mmap 的文件内容加载到对应的内存区域。

Firecracker 发送完载荷（即内存映射和文件描述符）后，Firecracker 与缺页处理程序进程之间不会再通过 UDS 套接字（或其他方式）进行任何通信。

### Userfaultfd 与 balloon 的交互

balloon 设备允许宿主机从 microVM 回收内存。有关 balloon 的更多细节，请参阅[这篇文档](https://github.com/firecracker-microvm/firecracker/blob/main/docs/ballooning.md)。

当 balloon 设备请求移除某个内存范围时，Firecracker 会以 `MADV_DONTNEED` 标志调用 `madvise`，告知内核可以释放该特定区域中的内存。发生这种系统调用时，userfaultfd 接口会发送 `UFFD_EVENT_REMOVE`。对于以 hugetlbfs 为后备的内存，Firecracker 只会对该范围内完整的大页调用 `madvise`；对于两端不完整的大页，则改为通过写入将其清零，因此处理程序不会收到这些页的 `UFFD_EVENT_REMOVE`。如果该页尚未填充，写入会引发一次缺页，处理程序会像处理其他缺页一样处理它。

实现缺页处理程序的逻辑时，用户必须识别 `UFFD_EVENT_REMOVE` 类型的事件，并通过将这些页清零来处理它们。这是因为内存虽然被移除了，但该区域仍处于 userfaultfd 的监视之下。经过一轮充气和放气之后，被 balloon 移除（随后又被缺页处理程序清零）的内存范围可能会再次发生缺页。在这种情况下，缺页处理程序进程必须将发生缺页的页清零（而不是从文件中调入），这也是 [userfaultfd 文档](https://www.kernel.org/doc/html/latest/admin-guide/mm/userfaultfd.html#non-cooperative-userfaultfd)所建议的做法。

如果 balloon 驱动程序遭到攻破，缺页处理程序可能会被大量 `UFFD_EVENT_REMOVE` 事件淹没。我们建议使用 jailer 内置的 cgroup 功能作为纵深防御，以限制 Firecracker 进程的资源使用。

### 注意事项

如果处理程序进程在 Firecracker 恢复快照期间崩溃，Firecracker 会在发生缺页时挂起。这是因为 Firecracker 被设计为等待所请求的页变为可用。如果此时缺页处理程序进程已不存在，Firecracker 将永远等待下去。用户应监控缺页处理程序的状态，或收集挂起的 Firecracker 进程的指标，并在必要时实现回收机制。

处理可能发生的任何错误，以及向 Firecracker 进程发送信号以告知其崩溃/退出，都是缺页处理程序进程的职责。缺页处理程序可以通过带 `SO_PEERCRED` 选项的 `getsockopt` 调用获取 Firecracker 的 PID，该调用会获取连接到套接字的对端进程的凭据。返回的凭据包含对端进程（对缺页处理程序而言即 Firecracker）的 PID、GID 和 UID。

我们建议缺页处理程序在等待 Firecracker 连接 UDS 或通过 UDS 发送信息时设置超时，以应对 Firecracker 在完成连接/发送数据之前就崩溃的意外情况。

### 示例

处理程序进程的示例可以在[这里](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/examples/uffd/on_demand_handler.rs)找到。该进程被设计为：在处理某个地址的缺页时，将该地址所属的整个内存区域加载到内存中；不过用户可以选择最适合其使用场景的任何其他行为。
