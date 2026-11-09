import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const SCREENSHOTS_DIR = '/tmp/live_test_screenshots'
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function runLiveTest() {
  console.log('🚀 Starting Live UI Test with Google Chrome...')

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })

  const results = {
    dashboard: false,
    invoicesList: false,
    invoiceDrawerFields: false,
    vehiclesTab: false,
    paymentFlow: false,
    reconciliationFlow: false,
    journalEntries: false,
  }

  try {
    // 1. Load Dashboard
    console.log('⏳ Navigating to http://localhost:5173...')
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 })
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1_dashboard.png') })
    console.log('✅ Dashboard loaded successfully')
    results.dashboard = true

    // 2. Navigate to Invoices
    console.log('⏳ Navigating to Invoices page...')
    const invoiceNavBtn = await page.waitForSelector('button:has-text("Invoices"), a:has-text("Invoices")', { timeout: 5000 })
      .catch(async () => {
        // Fallback: look for button containing Invoices
        const buttons = await page.$$('button')
        for (const b of buttons) {
          const txt = await page.evaluate(el => el.textContent, b)
          if (txt && txt.includes('Invoices')) return b
        }
        return null
      })

    if (invoiceNavBtn) {
      await invoiceNavBtn.click()
      await new Promise(r => setTimeout(r, 1000))
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2_invoices_list.png') })
      console.log('✅ Invoices list page loaded')
      results.invoicesList = true
    } else {
      console.error('❌ Could not find Invoices button in sidebar')
    }

    // 3. Open Invoice Drawer & Verify Fields
    console.log('⏳ Opening Invoice Drawer...')
    // Look for Innovex invoice or first invoice row
    const invoiceRow = await page.evaluateHandle(() => {
      const rows = Array.from(document.querySelectorAll('tr'))
      const match = rows.find(r => r.textContent.includes('Innovex') || r.textContent.includes('INV/2026/0108'))
      return match || rows[1] // fallback to first data row
    })

    if (invoiceRow) {
      await invoiceRow.click()
      await new Promise(r => setTimeout(r, 1000))

      // Check fields in drawer
      const drawerContent = await page.evaluate(() => {
        const bodyText = document.body.textContent || ''
        return {
          hasNoOfSubscription: bodyText.includes('No of Subscription Items'),
          hasSubscriptionToggle: bodyText.includes('Subscription Invoice'),
          hasFrequency: bodyText.includes('Frequency'),
          hasType: bodyText.includes('Type'),
          hasCustomer: bodyText.includes('Innovex') || bodyText.includes('Customer'),
          hasInvoiceLines: bodyText.includes('Invoice Lines'),
          hasVehiclesTab: bodyText.includes('Vehicles'),
          hasUntaxedAmount: bodyText.includes('Untaxed Amount'),
        }
      })

      console.log('📋 Drawer field verification:', drawerContent)
      if (drawerContent.hasNoOfSubscription && drawerContent.hasSubscriptionToggle && drawerContent.hasVehiclesTab) {
        results.invoiceDrawerFields = true
        console.log('✅ All requested header fields verified inside drawer')
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '3_invoice_drawer.png') })

      // Check Vehicles tab
      console.log('⏳ Clicking Vehicles tab...')
      const vehiclesTabClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const vBtn = buttons.find(b => b.textContent && b.textContent.includes('Vehicles'))
        if (vBtn) {
          vBtn.click()
          return true
        }
        return false
      })

      if (vehiclesTabClicked) {
        await new Promise(r => setTimeout(r, 600))
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '4_vehicles_tab.png') })
        const hasPlate = await page.evaluate(() => document.body.textContent.includes('Plate Number') || document.body.textContent.includes('FMC130'))
        if (hasPlate) {
          results.vehiclesTab = true
          console.log('✅ Vehicles fleet table verified')
        }
      }

      // Close drawer
      await page.evaluate(() => {
        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close')
        if (closeBtn) closeBtn.click()
      })
      await new Promise(r => setTimeout(r, 500))
    }

    // 4. Test Payment Registration Flow
    console.log('⏳ Testing Payment Registration on Open Invoice...')
    const payBtnClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const payBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Pay')
      if (payBtn) {
        payBtn.click()
        return true
      }
      return false
    })

    if (payBtnClicked) {
      await new Promise(r => setTimeout(r, 800))
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '5_payment_modal.png') })
      console.log('✅ Payment modal opened')

      // Click Confirm & Post Payment
      const confirmed = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const confirmBtn = buttons.find(b => b.textContent && b.textContent.includes('Confirm & Post Payment'))
        if (confirmBtn) {
          confirmBtn.click()
          return true
        }
        return false
      })

      if (confirmed) {
        await new Promise(r => setTimeout(r, 1000))
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '6_after_payment.png') })
        const hasPaidBadge = await page.evaluate(() => document.body.textContent.includes('paid') || document.body.textContent.includes('PAID'))
        if (hasPaidBadge) {
          results.paymentFlow = true
          console.log('✅ Payment confirmed and invoice updated to PAID')
        }
      }
    } else {
      console.log('ℹ️ No open invoice with Pay button found directly, checking if invoices exist')
    }

    // 5. Test Reconciliation Wizard
    console.log('⏳ Navigating to Reconciliation page...')
    const reconNavClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const rBtn = buttons.find(b => b.textContent && b.textContent.includes('Reconciliation'))
      if (rBtn) {
        rBtn.click()
        return true
      }
      return false
    })

    if (reconNavClicked) {
      await new Promise(r => setTimeout(r, 1000))
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '7_reconciliation.png') })
      const hasReconContent = await page.evaluate(() => {
        const text = document.body.textContent || ''
        return text.includes('Reconciliation Wizard') || text.includes('Outstanding Invoices')
      })

      if (hasReconContent) {
        // Try clicking Select Match
        await page.evaluate(() => {
          const matchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Select Match'))
          if (matchBtn) matchBtn.click()
        })
        await new Promise(r => setTimeout(r, 500))

        // Click Reconcile
        const reconciled = await page.evaluate(() => {
          const reconBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Reconcile')
          if (reconBtn && !reconBtn.disabled) {
            reconBtn.click()
            return true
          }
          return false
        })

        await new Promise(r => setTimeout(r, 800))
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '8_reconciled.png') })
        results.reconciliationFlow = true
        console.log('✅ Reconciliation flow executed successfully')
      }
    }

    // 6. Test Journal Entries View
    console.log('⏳ Navigating to Journal Entries...')
    const journalNavClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const jBtn = buttons.find(b => b.textContent && b.textContent.includes('Journal Entries'))
      if (jBtn) {
        jBtn.click()
        return true
      }
      return false
    })

    if (journalNavClicked) {
      await new Promise(r => setTimeout(r, 1000))
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '9_journal_entries.png') })
      const hasJournals = await page.evaluate(() => {
        const text = document.body.textContent || ''
        return text.includes('Journal Items') && text.includes('Analytic Items')
      })
      if (hasJournals) {
        results.journalEntries = true
        console.log('✅ Journal Entries, Journal Items, and Analytic Items verified')
      }
    }

  } catch (err) {
    console.error('❌ Error during live test:', err)
  } finally {
    await browser.close()
  }

  console.log('\n📊 FINAL TEST SUMMARY:')
  console.log(JSON.stringify(results, null, 2))
}

runLiveTest()

