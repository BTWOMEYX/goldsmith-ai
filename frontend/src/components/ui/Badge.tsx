type BadgeProps = {

    children: React.ReactNode

}

export default function Badge({

    children,

}: BadgeProps) {

    return (

        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">

            {children}

        </span>

    )

}