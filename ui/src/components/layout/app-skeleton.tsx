import { Skeleton } from '../ui/skeleton'

export function AppSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在载入本机数据">
      <div className="mb-8 border-b-2 border-ink pb-5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-4 h-12 w-[min(620px,90%)]" />
        <Skeleton className="mt-3 h-4 w-[min(520px,80%)]" />
      </div>

      <Skeleton className="h-[250px]" />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[340px] lg:col-span-7" />
        <Skeleton className="h-[340px] lg:col-span-5" />
        <Skeleton className="h-[250px] lg:col-span-7" />
        <Skeleton className="h-[250px] lg:col-span-5" />
      </div>
    </div>
  )
}
