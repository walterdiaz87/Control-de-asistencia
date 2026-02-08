export function Skeleton({ className }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
    );
}

export function AttendanceSkeleton() {
    return (
        <div className="space-y-4 pt-6">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="brand-card p-5 flex flex-col gap-5 bg-white ring-1 ring-slate-100">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-10 w-44 rounded-2xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}
