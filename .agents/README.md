# SOP Auto Fill Agent Workspace

`.agents/` adalah workspace internal untuk planning dan execution artifacts agent. Root `AGENTS.md` tetap menjadi policy utama repository.

## Operating Model

Default engineering loop:

```text
goal
  -> acceptance criteria
  -> RED
  -> GREEN
  -> REFACTOR
  -> focused verification
  -> PR / CI
  -> review + fixes on the same branch
  -> merge
  -> observe
```

Gunakan workspace ini untuk mendukung **fast verified delivery**, bukan menambah ceremony.

- TDD default untuk behavior change.
- Small vertical slices dan small batches.
- Satu task -> satu branch -> satu PR melalui seluruh feedback cycle.
- Focused tests untuk inner loop cepat; widen verification sesuai risk sebelum merge.
- WIP rendah; selesaikan task koheren sebelum membuka unrelated work jika tidak ada blocker.
- YAGNI; hindari speculative abstraction/infrastructure.
- Commit/branch/LOC/PR count bukan productivity KPI.
- Delivery health dinilai dari cycle time, PR lead time, CI feedback, rework, escaped defects, change failure rate, flaky tests, dan WIP age.

## Structure

```text
.agents/
  README.md
  CURRENT_ITERATION.md
  plans/
    YYYY-MM-DD-<topic>.md
```

Jangan menambah artifact type baru tanpa recurring need yang nyata.

## CURRENT_ITERATION.md

`CURRENT_ITERATION.md` adalah execution lock product iteration.

- Maintenance, tooling, documentation, CI, atau agent-policy update tidak otomatis membuka iteration baru.
- Jangan mengubah iteration/status hanya karena PR non-product merge.
- Product iteration baru dimulai hanya ketika user secara eksplisit mengubah goal/execution lock.

## Plans

Gunakan `plans/` ketika task memiliki sequencing, dependency, migration, security, concurrency, durable-state, public-contract, architecture, atau verification complexity yang memang perlu dicatat.

Plan yang baik berisi:

- goal dan acceptance criteria
- constraints/invariants
- implementation slices
- risk/failure modes penting
- verification gates

Jangan membuat heavyweight plan untuk perubahan trivial yang scope dan verification-nya sudah jelas.

## Source of Truth

1. Runtime code dan tests menentukan behavior aktual.
2. Root `AGENTS.md` menentukan engineering/agent execution policy.
3. `.agents/CURRENT_ITERATION.md` menentukan product iteration yang boleh dieksekusi.
4. `.agents/plans/` membantu sequencing pekerjaan kompleks.
5. Public/project docs menjelaskan behavior yang telah dirilis atau keputusan produk yang memang ditujukan untuk pembaca manusia.

Jika plan lama bertentangan dengan code/test yang sudah berubah secara sah, jangan mengikuti plan secara buta; validasi kondisi terkini lalu update artifact sebelum menggunakannya sebagai dasar eksekusi.
