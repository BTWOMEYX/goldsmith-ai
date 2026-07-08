import Card from "../ui/Card"

type Props = {

    title: string

    value: string

    colour: string

}

export default function DashboardStats({

    title,

    value,

    colour,

}: Props) {

    return (

        <Card title={title}>

            <p className={`text-4xl font-bold ${colour}`}>

                {value}

            </p>

        </Card>

    )

}