"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

function Separator({
    className,
    orientation = "horizontal",
    ...props
}: SeparatorPrimitive.Props) {
    return (
        <SeparatorPrimitive
            data-slot="separator"
            orientation={orientation}
            className={cn(
                "bg-foreground/20 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:h-8",
                className
            )}
            {...props}
        />
    )
}

export { Separator }
