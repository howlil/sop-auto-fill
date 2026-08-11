import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/arsip/$opdId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/arsip',
      search: { opdId: params.opdId },
    })
  },
})
