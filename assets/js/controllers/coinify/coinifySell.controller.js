angular
  .module('walletApp')
  .controller('CoinifySellController', CoinifySellController);

function CoinifySellController ($scope, $filter, $q, MyWallet, Wallet, MyWalletHelpers, Alerts, currency, $uibModalInstance, trade, buySellOptions, $timeout, $interval, formatTrade, buySell, $rootScope, $cookies, $window, country, accounts, $state, smartAccount) {
  $scope.debug;

  $scope.fields = {};
  $scope.settings = Wallet.settings;
  $scope.btcCurrency = $scope.settings.btcCurrency;
  $scope.currencies = currency.coinifySellCurrencies;
  $scope.user = Wallet.user;
  $scope.trades = buySell.trades;
  $scope.alerts = [];
  $scope.status = {};
  $scope.trade = trade;
  $scope.quote = buySellOptions.quote;
  $scope.isSell = buySellOptions.sell;
  $scope.sepaCountries = country.sepaCountryCodes;
  $scope.acceptTermsForm;
  $scope.transaction = {};
  $scope.bankAccounts = accounts;
  $scope.totalBalance = Wallet.my.wallet.balanceActiveAccounts / 100000000;
  $scope.step;

  $scope.bankAccount = {
    account: {
      currency: null
    },
    bank: {
      name: null,
      address: {
        country: null,
        street: null, // required for UK
        city: null, // required for UK
        zipcode: null // required for UK
      }
    },
    holder: {
      name: null,
      address: {
        country: null,
        street: null,
        city: null,
        zipcode: null,
        state: null
      }
    }
  };

  $scope.transaction = {
    btc: $scope.trade.btc,
    fiat: $scope.trade.fiat,
    currency: null,
    fee: {
      btc: null,
      fiat: null
    }
  };

  $scope.assignFiatCurrency = () => {
    if ($scope.trade._state) return;
    if ($scope.trade.quote.quoteCurrency === 'BTC') {
      $scope.transaction.currency = $scope.trade.quote.baseCurrency;
      $scope.bankAccount.account.currency = $scope.trade.quote.baseCurrency;
    } else {
      $scope.transaction.currency = $scope.trade.quote.quoteCurrency;
      $scope.bankAccount.account.currency = $scope.trade.quote.quoteCurrency;
    }
  };
  $scope.assignFiatCurrency();


  let exchange = buySell.getExchange();
  console.log('coinifySell $scope', $scope, exchange)

  $scope.exchange = exchange && exchange.profile ? exchange : {profile: {}};

  $scope.dateFormat = 'd MMMM yyyy, HH:mm';
  $scope.isKYC = $scope.trade && $scope.trade.constructor.name === 'CoinifyKYC';
  // $scope.needsKyc = () => +$scope.exchange.profile.level.name < 2;
  $scope.needsKyc = () => false;
  // $scope.needsISX = () => $scope.trade && !$scope.trade.bankAccount && buySell.tradeStateIn(buySell.states.pending)($scope.trade) || $scope.isKYC;
  $scope.needsISX = () => false;
  $scope.needsReview = () => $scope.trade && buySell.tradeStateIn(buySell.states.pending)($scope.trade);

  $scope.steps = {
    'accept-terms': 0,
    // 'isx': 1,
    'account-info': 1,
    'account-holder': 2,
    'bank-link': 3,
    'summary': 4,
    'review': 5,
    'isx': 6
  };

  $scope.onStep = (...steps) => steps.some(s => $scope.step === $scope.steps[s]);
  $scope.afterStep = (step) => $scope.step > $scope.steps[step];
  $scope.beforeStep = (step) => $scope.step < $scope.steps[step];
  $scope.currentStep = () => Object.keys($scope.steps).filter($scope.onStep)[0];

  $scope.goTo = (step) => $scope.step = $scope.steps[step];

  $scope.nextStep = () => {
    console.log('running nextStep function', $scope)
    if ($scope.trade._state) {
      $scope.mapTradeDetails();
      $scope.goTo('review');
      return;
    }
    if (!$scope.exchange.user || !$scope.user.isEmailVerified) {
      $scope.goTo('accept-terms');
    } else if (!$scope.bankAccounts || !$scope.bankAccounts.length) {
      $scope.goTo('account-info');
    } else if ($scope.bankAccounts) {
      $scope.goTo('bank-link');
    } else {
      $scope.goTo('summary');
    }
  };

  $scope.isDisabled = () => {
    const b = $scope.bankAccount;
    if ($scope.onStep('accept-terms')) {
      return !$scope.fields.acceptTOS;
    } else if ($scope.onStep('account-info')) {
      if ($scope.transaction.currency === 'GBP') {
        return (!b.bank.address.street || !b.bank.name || !b.bank.address.city || !b.bank.address.zipcode || !b.account.number || !b.account.bic)
      }
      // return (!bank.account.number || !bank.account.bic || !bank.bank.name || !bank.bank.address.country);
      return (!b.account.number || !b.account.bic);
    } else if ($scope.onStep('account-holder')) {
      return (!b.holder.name || !b.holder.address.street || !b.holder.address.zipcode || !b.holder.address.city || !b.holder.address.country)
    } else if ($scope.onStep('bank-link')) {
      return !$scope.selectedBankAccount;
    } else if ($scope.onStep('summary')) {
      // NOTE commented out for dev purposes
      // if ($scope.insufficientFunds() === true || !$scope.sellRateForm.$valid) {
      //   console.log('insufficientFunds')
      //   return true;
      // }
      if (!$scope.trade.quote) true;
      // return $scope.editAmount || !$scope.limits.max;
    }
  };

  $scope.insufficientFunds = () => {
    const tx = $scope.transaction;
    const combined = tx.btc + tx.fee.btc;
    if (combined > $scope.totalBalance) {
      return true;
    }
  };

  $scope.createBankAccount = () => {
    $scope.status.waiting = true;
    $scope.bankAccount.account.currency = $scope.transaction.currency;
    $q.resolve(buySell.createBankAccount($scope.bankAccount))
      .then((result) => {
        console.log('result of creating bank account', result)
        $scope.selectedBankAccount = result;
        $scope.status = {};
        return result;
      })
      .then(data => {
        if (!data) {
          Alerts.displayError('BANK_ACCOUNT_CREATION_FAILED')
          $scope.goTo('account-info');
        } else {
          $scope.goTo('summary');
        }
      })
      .catch(err => {
        console.log('err', err)
        $scope.status = {};
      })
  }

  $scope.getBankAccounts = () => {
    $q.resolve(buySell.getBankAccounts())
      .then((result) => {
        if (result) {
          console.log('result in getBankAccounts', result)
          $scope.registeredBankAccount = true;
          $scope.bankAccounts = result;
          return result;
        } else {
          $scope.registeredBankAccount = false;
          $scope.bankAccounts = null;
        }
      })
  };

  $scope.goToOrderHistory = () => {
    if ($scope.onStep('accept-terms') || $scope.onStep('trade-formatted') || !$scope.trades.pending.length || $state.params.selectedTab === 'ORDER_HISTORY') {
      $uibModalInstance.dismiss('');
    } else {
      $state.go('wallet.common.buy-sell.coinify', {selectedTab: 'ORDER_HISTORY'});
    }
  };

  $scope.startPayment = () => {
    if ($scope.trade._state) return;

    let index = Wallet.getDefaultAccountIndex();
    // .fee(absoluteFeeBounds [0])

    $scope.payment = Wallet.my.wallet.createPayment();

    let tradeInSatoshi = currency.convertToSatoshi($scope.trade.btc, currency.bitCurrencies[0])


    $scope.payment.from(index).amount(tradeInSatoshi)
    // $scope.payment.from(index).amount(100000)

    $scope.payment.sideEffect(result => {
      console.log('result of sideEffect', result)

      // const firstBlockFee = result.sweepFees[0];
      const firstBlockFee = result.absoluteFeeBounds[0];

      console.log('firstBlockFee', firstBlockFee)
      $scope.payment.fee(firstBlockFee);
      $scope.transaction.fee.btc = currency.convertFromSatoshi(firstBlockFee, currency.bitCurrencies[0]);
      const amountAfterFee = $scope.transaction.btc + $scope.transaction.fee.btc;
      console.log('amountAfterFee', amountAfterFee);
      $scope.transaction.btcAfterFee = parseFloat(amountAfterFee.toFixed(8));
      $scope.payment.amount(amountAfterFee / 100000000) // in SATOSHI
      // let date = + new Date();
    })
  };
  $scope.startPayment();

  $scope.cancel = () => {
    console.log('cancel called')
    $rootScope.$broadcast('fetchExchangeProfile');
    $uibModalInstance.dismiss('');
    $scope.trade = null;
    buySell.getTrades().then(() => {
      $scope.goToOrderHistory();
    });
  };

  $scope.close = () => {
    $scope.cancel();
  };

  $scope.dismiss = () => {
    $uibModalInstance.dismiss('');
  }

  $scope.mapTradeDetails = () => {
    const t = $scope.trade;
    $scope.sellTrade = {
      id: t._id,
      createTime: t.createdAt,
      transferIn: {receiveAmount: t._inAmount / 100000000},
      transferOut: {receiveAmount: t.outAmountExpected / 100, currency: t._outCurrency},
    }
    $scope.formatBankInfo(t);
  };

  $scope.getReadyToSend = () => {
    // get fee
    // get Origin address payment.from(origin, fee)
    // add To address payment.to(origin)
    // add Amount payment.amount(amount, absoluteFee)
    // build?
    $scope.payment = Wallet.my.wallet.createPayment();

    // $scope.payment.from(Wallet.getDefaultAccountIndex()).to().amount()
    //
    // console.log('scope.payment', $scope)
    // const origin = smartAccount.getDefault();
    // console.log('origin', origin)
    // console.log('from', from)
    // $scope.payment.from(origin, 1)
  }



  /* Will need to use this for if user has 2nd PW set

  const signAndPublish = (passphrase) => {
    return $scope.payment.sideEffect(setCheckpoint)
      .sign(passphrase).publish().payment;
  };

  Wallet.askForSecondPasswordIfNeeded().then(signAndPublish)
    .then(transactionSucceeded).catch(transactionFailed);

  */


  const transactionFailed = (message) => {

    let msgText = typeof message === 'string' ? message : 'SEND_FAILED';
    if (msgText.indexOf('Fee is too low') > -1) msgText = 'LOW_FEE_ERROR';

    if (msgText.indexOf('Transaction Already Exists') > -1) {
      $uibModalInstance.close();
    } else {
      Alerts.displayError(msgText, false, $scope.alerts);
    }
  };

  const transactionSucceeded = (tx) => {
    $timeout(() => {
      Wallet.beep();
      let message = 'BITCOIN_SENT';
      Alerts.displaySentBitcoin(message);
    }, 500);
  };

  let paymentCheckpoint;
  const setCheckpoint = (payment) => {
    paymentCheckpoint = payment;
  };

  const signAndPublish = (passphrase) => {
    return $scope.payment.sideEffect(setCheckpoint)
      .sign(passphrase).publish().payment;
  };


  $scope.sell = () => {

    $scope.status.waiting = true;

    $q.resolve(buySell.createSellTrade($scope.trade.quote, $scope.selectedBankAccount))
      .then((sellResult) => {
        if (!sellResult) {
          console.log('error creating sell trade')
          Alerts.displayError() //TODO
        }
        console.log('sell created', sellResult)
        $scope.sellTrade = sellResult;

        $scope.sendAddress = sellResult.transferIn.details.account; // coinify receive addr

        // '1FrYGs1PCdaJ7yyHbQY2mHQzD9YotKrudu'
        // $scope.sendAddress = '15XPS4LjoJmyTUG7VAfRvwfCT5f8f6T13C' // testing
        $scope.sendAmount = sellResult.transferIn.sendAmount * 100000000; // to satoshi for payment.amount()

        return sellResult;
      })
      .then((sellData) => {
        // send btc to coinify
        console.log('assign payment.to and payment.amount', $scope.sendAddress, $scope.sendAmount)
        $scope.payment.to($scope.sendAddress);

        $scope.payment.amount($scope.sendAmount);

        if (exchange._customAddress && exchange._customAmount) {
          console.log('customAddress and customAmount', exchange._customAddress, exchange._customAmount)
          $scope.payment.to(exchange._customAddress);
          $scope.payment.amount(exchange._customAmount);
          // 10000 SATOSHI is ~.11 EUR
        }

        // $scope.payment.amount(5000) // testing - send tiny amounts

        console.log('build payment')
        $scope.payment.build();

        console.log('ask for 2nd PW and send btc', $scope)
        Wallet.askForSecondPasswordIfNeeded()
          .then(signAndPublish)
          .then(transactionSucceeded)
          .catch(err => {
            console.log('err when publishing', err)
            transactionFailed(err);
          })
      })
      .finally(() => {
        console.log('finally')
        // NOTE fix formatBankInfo() but put it in here
        // $scope.formatBankInfo();
        $scope.status.waiting = false;
        $scope.goTo('review')
      })
      .catch(err => {
        console.log('err in coinify sell controller', err)
        // TODO handle error
      })
  };

  // TODO this whole thing needs to be refactored
  $scope.formatBankInfo = (trade) => {
    const b = $scope.bankAccount;
    if (trade) {
      if (trade._bankName) {
        $scope.bankNameOrNumber = trade._bankName;
        return;
      }
      $scope.bankNameOrNumber = trade._lastFourBankAccountDigits;
      return;
    }
    if (!$scope.bankAccount.bank.name) {
      if (!b.account.number) {
        $scope.bankNameorNumber = $scope.selectedBankAccount.account.number.substring($scope.selectedBankAccount.account.number.length, $scope.selectedBankAccount.account.number.length - 4);
        return;
      }
      $scope.bankNameOrNumber = b.account.number.substring(b.account.number.length, b.account.number.length - 4);
      return;
    }
    $scope.bankNameOrNumber = b.bank.name;
  };



  if (!$scope.step) $scope.nextStep();

}
