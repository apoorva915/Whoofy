#!/usr/bin/env node
/**
 * Cross-platform Tesseract OCR installation script
 * Supports Windows (via Chocolatey) and macOS (via Homebrew)
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as process from 'process';

const execAsync = promisify(exec);

interface PlatformInfo {
  platform: 'windows' | 'macos' | 'linux' | 'unsupported';
  packageManager: 'choco' | 'brew' | 'apt' | 'dnf' | 'none';
}

/**
 * Detect the current platform and available package manager
 */
function detectPlatform(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'win32') {
    // Check if Chocolatey is available
    try {
      execSync('choco --version', { stdio: 'ignore' });
      return { platform: 'windows', packageManager: 'choco' };
    } catch {
      return { platform: 'windows', packageManager: 'none' };
    }
  } else if (platform === 'darwin') {
    // Check if Homebrew is available
    try {
      execSync('brew --version', { stdio: 'ignore' });
      return { platform: 'macos', packageManager: 'brew' };
    } catch {
      return { platform: 'macos', packageManager: 'none' };
    }
  } else if (platform === 'linux') {
    // Check for apt (Debian/Ubuntu)
    try {
      execSync('apt-get --version', { stdio: 'ignore' });
      return { platform: 'linux', packageManager: 'apt' };
    } catch {
      // Check for dnf (Fedora/RHEL)
      try {
        execSync('dnf --version', { stdio: 'ignore' });
        return { platform: 'linux', packageManager: 'dnf' };
      } catch {
        return { platform: 'linux', packageManager: 'none' };
      }
    }
  }

  return { platform: 'unsupported', packageManager: 'none' };
}

/**
 * Check if Tesseract is already installed
 */
async function isTesseractInstalled(): Promise<boolean> {
  try {
    await execAsync('tesseract --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Install Tesseract on Windows using Chocolatey
 */
async function installWindowsChoco(): Promise<boolean> {
  console.log('📦 Installing Tesseract using Chocolatey...');
  try {
    const { stdout, stderr } = await execAsync('choco install tesseract -y', {
      stdio: 'inherit',
    } as any);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to install Tesseract with Chocolatey:', error.message);
    return false;
  }
}

/**
 * Install Tesseract on macOS using Homebrew
 */
async function installMacBrew(): Promise<boolean> {
  console.log('🍺 Installing Tesseract using Homebrew...');
  try {
    const { stdout, stderr } = await execAsync('brew install tesseract', {
      stdio: 'inherit',
    } as any);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to install Tesseract with Homebrew:', error.message);
    return false;
  }
}

/**
 * Install Tesseract on Linux using apt-get
 */
async function installLinuxApt(): Promise<boolean> {
  console.log('📦 Installing Tesseract using apt-get...');
  try {
    // Check if running as root (only works on Unix-like systems)
    let isRoot = false;
    try {
      isRoot = process.getuid ? process.getuid() === 0 : false;
    } catch {
      isRoot = false;
    }
    const sudoPrefix = isRoot ? '' : 'sudo ';

    const { stdout, stderr } = await execAsync(
      `${sudoPrefix}apt-get update && ${sudoPrefix}apt-get install -y tesseract-ocr`,
      {
        stdio: 'inherit',
      } as any
    );
    return true;
  } catch (error: any) {
    console.error('❌ Failed to install Tesseract with apt-get:', error.message);
    return false;
  }
}

/**
 * Install Tesseract on Linux using dnf
 */
async function installLinuxDnf(): Promise<boolean> {
  console.log('📦 Installing Tesseract using dnf...');
  try {
    // Check if running as root (only works on Unix-like systems)
    let isRoot = false;
    try {
      isRoot = process.getuid ? process.getuid() === 0 : false;
    } catch {
      isRoot = false;
    }
    const sudoPrefix = isRoot ? '' : 'sudo ';

    const { stdout, stderr } = await execAsync(
      `${sudoPrefix}dnf install -y tesseract`,
      {
        stdio: 'inherit',
      } as any
    );
    return true;
  } catch (error: any) {
    console.error('❌ Failed to install Tesseract with dnf:', error.message);
    return false;
  }
}

/**
 * Verify Tesseract installation
 */
async function verifyInstallation(): Promise<boolean> {
  console.log('\n🔍 Verifying Tesseract installation...');
  try {
    const { stdout } = await execAsync('tesseract --version');
    console.log('✅ Tesseract is installed successfully!');
    console.log(stdout);
    return true;
  } catch (error: any) {
    console.error('❌ Tesseract verification failed:', error.message);
    return false;
  }
}

/**
 * Print manual installation instructions
 */
function printManualInstructions(platformInfo: PlatformInfo): void {
  console.log('\n📝 Manual Installation Instructions:\n');
  
  if (platformInfo.platform === 'windows') {
    console.log('Windows:');
    console.log('1. Download Tesseract installer from:');
    console.log('   https://github.com/UB-Mannheim/tesseract/wiki');
    console.log('2. Run the installer');
    console.log('3. Add Tesseract to your PATH (usually: C:\\Program Files\\Tesseract-OCR)');
    console.log('\nOr install Chocolatey first, then run this script again:');
    console.log('   https://chocolatey.org/install');
  } else if (platformInfo.platform === 'macos') {
    console.log('macOS:');
    console.log('1. Install Homebrew if not already installed:');
    console.log('   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    console.log('2. Then run this script again, or manually run:');
    console.log('   brew install tesseract');
  } else if (platformInfo.platform === 'linux') {
    console.log('Linux:');
    if (platformInfo.packageManager === 'apt') {
      console.log('Run: sudo apt-get update && sudo apt-get install -y tesseract-ocr');
    } else if (platformInfo.packageManager === 'dnf') {
      console.log('Run: sudo dnf install -y tesseract');
    } else {
      console.log('Install Tesseract using your distribution\'s package manager');
    }
  }
}

/**
 * Main installation function
 */
async function main(): Promise<void> {
  console.log('🔧 Tesseract OCR Installation Script\n');
  console.log('This script will automatically install Tesseract OCR on your system.\n');
  console.log('Note: You may need administrator/sudo privileges for installation.');
  console.log('On Windows: Run PowerShell/CMD as Administrator');
  console.log('On macOS/Linux: You may be prompted for your password\n');

  // Check if already installed
  if (await isTesseractInstalled()) {
    console.log('✅ Tesseract is already installed!');
    await verifyInstallation();
    return;
  }

  // Detect platform
  const platformInfo = detectPlatform();
  console.log(`Detected platform: ${platformInfo.platform}`);
  console.log(`Available package manager: ${platformInfo.packageManager}\n`);

  let success = false;

  // Install based on platform
  if (platformInfo.platform === 'windows' && platformInfo.packageManager === 'choco') {
    success = await installWindowsChoco();
  } else if (platformInfo.platform === 'macos' && platformInfo.packageManager === 'brew') {
    success = await installMacBrew();
  } else if (platformInfo.platform === 'linux' && platformInfo.packageManager === 'apt') {
    success = await installLinuxApt();
  } else if (platformInfo.platform === 'linux' && platformInfo.packageManager === 'dnf') {
    success = await installLinuxDnf();
  } else {
    console.log('⚠️  Automatic installation not available for your platform/package manager.');
    printManualInstructions(platformInfo);
    process.exit(1);
  }

  if (success) {
    // Verify installation
    const verified = await verifyInstallation();
    if (verified) {
      console.log('\n🎉 Tesseract installation completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Installation may have completed, but verification failed.');
      console.log('Please verify manually by running: tesseract --version');
      process.exit(1);
    }
  } else {
    console.log('\n❌ Installation failed. Please try manual installation.');
    printManualInstructions(platformInfo);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
