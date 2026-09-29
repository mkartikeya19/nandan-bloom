<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project architecture

- Keep user-deletion orchestration in `src/lib/user-deletion.ts`; this makes the cross-system fail-safe sequence independently testable while database functions enforce authorization and persistence.
- Treat generated integration and route-tree files as lint/format inputs owned by their generators; exclude them rather than manually rewriting generated output.
