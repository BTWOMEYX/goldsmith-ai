type CardProps = {
    title: string
    children: React.ReactNode
}

export default function Card({
    title,
    children,
}: CardProps) {

    return (

        <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">

            <div className="border-b border-slate-800 px-6 py-4">

                <h2 className="text-lg font-semibold text-white">

                    {title}

                </h2>

            </div>

            <div className="p-6">

                {children}

            </div>

        </div>

    )

}