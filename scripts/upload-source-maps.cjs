#!/usr/bin/env node
/**
 * Upload source maps to Bugsnag for production debugging
 * Run this script after the Nuxt build completes
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const BUGSNAG_API_KEY = process.env.BUGSNAG_API_KEY
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || '1.0.0'
const UPLOAD_ENABLED = process.env.BUGSNAG_SOURCE_MAPS_UPLOAD_ENABLED === 'true'

// Exit early if upload is disabled
if (!UPLOAD_ENABLED) {
  console.log('[Bugsnag] Source maps upload disabled (BUGSNAG_SOURCE_MAPS_UPLOAD_ENABLED != true)')
  process.exit(0)
}

// Exit early if no API key
if (!BUGSNAG_API_KEY) {
  console.warn('[Bugsnag] API key not found, skipping source maps upload')
  process.exit(0)
}

const outputDir = path.join(__dirname, '../.output')

// Check if output directory exists
if (!fs.existsSync(outputDir)) {
  console.error('[Bugsnag] Output directory not found (.output)')
  console.log('[Bugsnag] Make sure to run this script after `nuxt build`')
  process.exit(0) // Don't fail the build
}

console.log(`[Bugsnag] Uploading source maps for version ${APP_VERSION}`)

// Function to upload source maps for a directory
function uploadSourceMaps(directory) {
  const fullPath = path.join(outputDir, directory)

  if (!fs.existsSync(fullPath)) {
    console.log(`[Bugsnag] Directory ${directory} not found, skipping`)
    return false
  }

  try {
    console.log(`[Bugsnag] Uploading ${directory} source maps...`)

    execSync(
      `npx @bugsnag/source-maps upload-browser \
        --api-key ${BUGSNAG_API_KEY} \
        --app-version ${APP_VERSION} \
        --directory ${fullPath} \
        --overwrite`,
      {
        stdio: 'inherit',
        env: { ...process.env },
      }
    )

    console.log(`[Bugsnag] Successfully uploaded ${directory} source maps`)
    return true
  } catch (error) {
    console.error(`[Bugsnag] Failed to upload ${directory} source maps:`, error.message)
    return false
  }
}

// Upload client-side source maps (public directory)
const clientSuccess = uploadSourceMaps('public/_nuxt')

// Summary
console.log('[Bugsnag] Source maps upload complete')
if (clientSuccess) {
  console.log(`[Bugsnag] Version: ${APP_VERSION}`)
} else {
  console.warn('[Bugsnag] Some uploads failed - check logs above')
}

// Always exit successfully to not break the build
process.exit(0)
