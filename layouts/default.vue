<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <a href="#main-content" class="skip-link"> Hoppa till huvudinnehåll </a>
    <V2PromoBanner />
    <AppHeader />
    <main id="main-content">
      <slot />
    </main>
    <footer
      class="py-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800"
    >
      <p>Stryktipset AI Predictor</p>
    </footer>
  </div>
</template>
