// VVV (Venice Token) payment on Base via the injected wallet. Mirrors
// payment.ts (USDC) but for the dev-API credit packs: transfer a fixed VVV
// amount to the treasury, wait for the receipt, then have the backend verify
// the tx and credit the account.

import { verifyVvvPayment, getApiConfig } from './api';

// VVV token (NOT the staking contract). Backend is the source of truth via
// getApiConfig(); this is only a fallback if that call fails.
const VVV_CONTRACT_FALLBACK = '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf';
const TREASURY_FALLBACK = '0x8C33e20E5b313E3740dd24177205B7e623Bf2292';
const BASE_CHAIN_ID = '0x2105'; // 8453
const VVV_DECIMALS = 18;

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

// Convert a decimal VVV amount (e.g. 110) to base units (×10^18) without float rounding.
function toBaseUnits(amount: number, decimals: number): bigint {
  const [whole, frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export interface VvvPayResult { credits: number; creditsAdded: number; vvvPaid: number }

/**
 * Send `vvvAmount` VVV to the treasury for `packId` and verify. `onStep`
 * reports progress. Returns the updated balance on success; throws on failure.
 */
export async function sendVvvPayment(
  packId: string,
  vvvAmount: number,
  onStep: (s: PayStep) => void,
): Promise<VvvPayResult> {
  const eth = getEth();
  if (!eth) throw new Error('No wallet detected - install MetaMask');

  onStep('confirming');
  try {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    const from = accounts?.[0];
    if (!from) throw new Error('No wallet account');

    await ensureBase(eth);

    let treasury = TREASURY_FALLBACK;
    let contract = VVV_CONTRACT_FALLBACK;
    let decimals = VVV_DECIMALS;
    try {
      const cfg = await getApiConfig();
      if (cfg.treasuryWallet) treasury = cfg.treasuryWallet;
      if (cfg.veniceContract) contract = cfg.veniceContract;
      if (cfg.veniceDecimals) decimals = cfg.veniceDecimals;
    } catch { /* fallback */ }

    const raw = toBaseUnits(vvvAmount, decimals);
    const data = encodeTransfer(treasury, raw);

    const hash = (await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: contract, data }],
    })) as string;

    onStep('pending');
    await waitForReceipt(eth, hash);

    onStep('verifying');
    const result = await verifyVvvPayment(hash, packId);
    if (!result.success) throw new Error('Payment verification failed');

    onStep('success');
    return { credits: result.credits, creditsAdded: result.creditsAdded, vvvPaid: result.vvvPaid };
  } catch (err) {
    onStep('error');
    const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (m.includes('user rejected') || m.includes('user denied') || m.includes('rejected the request')) {
      throw new Error('Transaction cancelled');
    }
    if (m.includes('insufficient')) throw new Error('Insufficient VVV balance');
    throw err instanceof Error ? err : new Error('Payment failed');
  }
}
