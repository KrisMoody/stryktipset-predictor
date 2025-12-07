export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'green',
      success: 'emerald',
      warning: 'amber',
      error: 'red',
    },
    alert: {
      compoundVariants: [
        {
          color: 'warning',
          class: {
            root: 'bg-amber-100 dark:bg-amber-900/30',
            title: 'text-amber-900 dark:text-amber-100',
            description: 'text-amber-800 dark:text-amber-200',
            icon: 'text-amber-600 dark:text-amber-400',
          },
        },
      ],
    },
    badge: {
      compoundVariants: [
        {
          color: 'success',
          variant: 'subtle',
          class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
        },
        {
          color: 'error',
          variant: 'subtle',
          class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        },
      ],
    },
  },
})
