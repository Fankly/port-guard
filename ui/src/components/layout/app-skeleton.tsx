import { Skeleton } from '../ui/skeleton'

export function AppSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在载入本机数据">
      <div className="mb-6 flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <Skeleton className="h-[218px] rounded-2xl" />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[320px] rounded-xl lg:col-span-7" />
        <Skeleton className="h-[320px] rounded-xl lg:col-span-5" />
        <Skeleton className="h-[240px] rounded-xl lg:col-span-7" />
        <Skeleton className="h-[240px] rounded-xl lg:col-span-5" />
      </div>
    </div>
  )
}
