<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const toneStyles: Record<'connecting' | 'open' | 'closed', string> = {
  connecting: 'border-yellow-500/40 bg-yellow-500/20 text-yellow-300',
  open: 'border-green-500/40 bg-green-500/20 text-green-300',
  closed: 'border-red-500/40 bg-red-500/20 text-red-300',
}

type BadgeVariants = VariantProps<typeof badgeVariants>
type Tone = keyof typeof toneStyles

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants['variant']
    tone?: Tone
    class?: string
  }>(),
  { variant: 'default' },
)

const delegatedProps = computed(() => {
  const { class: _class, tone: _tone, ...rest } = props
  return rest
})
</script>

<template>
  <div
    :class="cn(props.tone ? toneStyles[props.tone] : badgeVariants({ variant: props.variant }), props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </div>
</template>
