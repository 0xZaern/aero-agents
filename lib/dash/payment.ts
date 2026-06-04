// USDC-on-Base payment via the injected wallet (no wagmi/viem). Mirrors
// the original useUsdcPayment: transfer USDC to the treasury, wait for the
// receipt, then have the backend verify the tx and credit the account.

import { verifyPayment, getPaymentConfig } from './api';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY_FALLBACK = '0x8C33e20E5b313E3740dd24177205B7e623Bf2292';
const BASE_CHAIN_ID = '0x2105'; // 8453
const USDC_DECIMALS = 6;

export type PayStep = 'idle' | 'confirming' | 'pending' | 'verifying' | 'success' | 'error';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEth(): Eth | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eth }).ethereum : undefined;
}

function encodeTransfer(to: string, amount: bigint): string {
  const selector = 'a9059cbb';
  const addr = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amt = amount.toString(16).padStart(64, '0');
  return '0x' + selector + addr + amt;
}

async function ensureBase(eth: Eth): Promise<void> {
  const chainId = (await eth.request({ method: 'eth_chainId' })) as string;
  if (chainId === BASE_CHAIN_ID) return;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
  } catch (e) {
    if ((e as { code?: number })?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_CHAIN_ID, chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw e;
    }
  }
}

async function waitForReceipt(eth: Eth, hash: string, tries = 80): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const r = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as { blockNumber?: string; status?: string } | null;
    if (r && r.blockNumber) {
      if (r.status && r.status === '0x0') throw new Error('Transaction failed on-chain');
      return;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Timed out waiting for confirmation');
}

export interface PayResult { credits: number; plan: string; proExpiresAt: string | null }

/**
 * Send `amount` USD of USDC to the treasury and verify. `onStep` reports
 * progress. Returns the updated credits/plan on success; throws on failure.
 */
export async function sendUsdcPayment(
  amount: number,
  paymentType: 'credits' | 'pro',
  onStep: (s: PayStep) => void,
): Promise<PayResult> {
  const eth = getEth();
  if (!eth) throw new Error('No wallet detected - install MetaMask');

  onStep('confirming');
  try {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    const from = accounts?.[0];
    if (!from) throw new Error('No wallet account');

    await ensureBase(eth);

    let treasury = TREASURY_FALLBACK;
    try { const cfg = await getPaymentConfig(); if (cfg.treasuryWallet) treasury = cfg.treasuryWallet; } catch { /* fallback */ }

    const raw = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    const data = encodeTransfer(treasury, raw);

    const hash = (await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: USDC_CONTRACT, data }],
    })) as string;

    onStep('pending');
    await waitForReceipt(eth, hash);

    onStep('verifying');
    const result = await verifyPayment(hash, paymentType);
    if (!result.success) throw new Error('Payment verification failed');

    onStep('success');
    return { credits: result.credits, plan: result.plan, proExpiresAt: result.proExpiresAt };
  } catch (err) {
    onStep('error');
    const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (m.includes('user rejected') || m.includes('user denied') || m.includes('rejected the request')) {
      throw new Error('Transaction cancelled');
    }
    if (m.includes('insufficient')) throw new Error('Insufficient USDC balance');
    throw err instanceof Error ? err : new Error('Payment failed');
  }
}
