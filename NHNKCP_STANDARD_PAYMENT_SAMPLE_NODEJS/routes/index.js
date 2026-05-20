var express = require('express');
var router = express.Router();
var fetch = require('node-fetch');


// 테스트용 인증서정보(직렬화)
const KCP_CERT_INFO = '-----BEGIN CERTIFICATE-----MIIDgTCCAmmgAwIBAgIHBy4lYNG7ojANBgkqhkiG9w0BAQsFADBzMQswCQYDVQQGEwJLUjEOMAwGA1UECAwFU2VvdWwxEDAOBgNVBAcMB0d1cm8tZ3UxFTATBgNVBAoMDE5ITktDUCBDb3JwLjETMBEGA1UECwwKSVQgQ2VudGVyLjEWMBQGA1UEAwwNc3BsLmtjcC5jby5rcjAeFw0yMTA2MjkwMDM0MzdaFw0yNjA2MjgwMDM0MzdaMHAxCzAJBgNVBAYTAktSMQ4wDAYDVQQIDAVTZW91bDEQMA4GA1UEBwwHR3Vyby1ndTERMA8GA1UECgwITG9jYWxXZWIxETAPBgNVBAsMCERFVlBHV0VCMRkwFwYDVQQDDBAyMDIxMDYyOTEwMDAwMDI0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAppkVQkU4SwNTYbIUaNDVhu2w1uvG4qip0U7h9n90cLfKymIRKDiebLhLIVFctuhTmgY7tkE7yQTNkD+jXHYufQ/qj06ukwf1BtqUVru9mqa7ysU298B6l9v0Fv8h3ztTYvfHEBmpB6AoZDBChMEua7Or/L3C2vYtU/6lWLjBT1xwXVLvNN/7XpQokuWq0rnjSRThcXrDpWMbqYYUt/CL7YHosfBazAXLoN5JvTd1O9C3FPxLxwcIAI9H8SbWIQKhap7JeA/IUP1Vk4K/o3Yiytl6Aqh3U1egHfEdWNqwpaiHPuM/jsDkVzuS9FV4RCdcBEsRPnAWHz10w8CX7e7zdwIDAQABox0wGzAOBgNVHQ8BAf8EBAMCB4AwCQYDVR0TBAIwADANBgkqhkiG9w0BAQsFAAOCAQEAg9lYy+dM/8Dnz4COc+XIjEwr4FeC9ExnWaaxH6GlWjJbB94O2L26arrjT2hGl9jUzwd+BdvTGdNCpEjOz3KEq8yJhcu5mFxMskLnHNo1lg5qtydIID6eSgew3vm6d7b3O6pYd+NHdHQsuMw5S5z1m+0TbBQkb6A9RKE1md5/Yw+NymDy+c4NaKsbxepw+HtSOnma/R7TErQ/8qVioIthEpwbqyjgIoGzgOdEFsF9mfkt/5k6rR0WX8xzcro5XSB3T+oecMS54j0+nHyoS96/llRLqFDBUfWn5Cay7pJNWXCnw4jIiBsTBa3q95RVRyMEcDgPwugMXPXGBwNoMOOpuQ==-----END CERTIFICATE-----';

// INDEX PAGE
router.get('/', function(req, res) {
  res.render('index', {
    title : '가맹점 결제 샘플 페이지'
  });
});

// ORDER PAGE(PC)
router.get('/sample/order', function(req, res) {
  res.render('sample/order');
});

// MOBILE 거래등록 PAGE
router.get('/mobile_sample/trade_reg', function(req, res) {
  res.render('mobile_sample/trade_reg');
});

// MOBILE 거래등록 API
router.post('/mobile_sample/kcp_api_trade_reg', function(req, res) {
  // 거래등록처리 POST DATA
  var van_code = f_get_parm(req.body.van_code); // (포인트,상품권 인증창 호출 시 필요)

  var post_data = {
    van_code : van_code
  };

  // 거래등록 API REQ DATA
  var req_data = {
    site_cd : f_get_parm(req.body.site_cd),
    Ret_URL : f_get_parm(req.body.Ret_URL),
    ordr_idxx : f_get_parm(req.body.ordr_idxx),
    good_mny : f_get_parm(req.body.good_mny),
    good_name : f_get_parm(req.body.good_name),
    pay_method : f_get_parm(req.body.pay_method),
    user_agent : f_get_parm(req.body.user_agent)
  };

  // 거래등록 API URL
  // 테스트 : https://testsmpay.kcp.co.kr/trade/register.do
  // 운영 : https://smpay.kcp.co.kr/trade/register.do
  fetch("https://testsmpay.kcp.co.kr/trade/register.do", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req_data),
    })
    // 거래등록 API RES
    .then(response => {
      return response.json();
    })
    .then(data => {
      res.render('mobile_sample/kcp_api_trade_reg', {
        req_data : req_data,
        res_data : data,
        post_data : post_data
    });
  });
});

// 주문페이지 이동 및 Ret_URL 처리(MOBILE)
router.post('/mobile_sample/order_mobile', function(req, res) {
  var res_cd = f_get_parm(req.body.res_cd); 
  if( res_cd == '0000') {
    var enc_info = f_get_parm(req.body.enc_info);
    if( enc_info == '') {
      post_data = {
        res_cd : res_cd,
        approvalKey : f_get_parm(req.body.approvalKey),
        PayUrl : f_get_parm(req.body.PayUrl),
        pay_method : f_get_parm(req.body.pay_method),
        Ret_URL : f_get_parm(req.body.Ret_URL),
        van_code : f_get_parm(req.body.van_code),
        site_cd : f_get_parm(req.body.site_cd),
        ordr_idxx : f_get_parm(req.body.ordr_idxx),
        good_name : f_get_parm(req.body.good_name),
        good_mny : f_get_parm(req.body.good_mny)
      };
    } else {      
      post_data = {
        res_cd : res_cd,
        site_cd : f_get_parm(req.body.site_cd), 
        tran_cd : f_get_parm(req.body.tran_cd),
        ordr_idxx : f_get_parm(req.body.ordr_idxx),
        good_name : f_get_parm(req.body.good_name), 
        good_mny : f_get_parm(req.body.good_mny), 
        buyr_name : f_get_parm(req.body.buyr_name), 
        buyr_tel2 : f_get_parm(req.body.buyr_tel2),
        buyr_mail : f_get_parm(req.body.buyr_mail),
        enc_info : enc_info,  
        enc_data : f_get_parm(req.body.enc_data),
        param_opt_1 : '',
        param_opt_2 : '',
        param_opt_3 : '' 
      };
    }

  } else {
    post_data = {
      res_cd : res_cd,       
      res_msg : f_get_parm(req.body.res_msg)
    };
  }
  res.render('mobile_sample/order_mobile', {
    post_data : post_data
  });

});

// 결제요청 API
router.post('/kcp_api_pay', function(req, res) {
  var site_cd = f_get_parm(req.body.site_cd);
  
  // 결제 REQ DATA
  var req_data = {
    tran_cd : f_get_parm(req.body.tran_cd),
    site_cd : site_cd,
    kcp_cert_info : KCP_CERT_INFO,
    enc_data : f_get_parm(req.body.enc_data),
    enc_info : f_get_parm(req.body.enc_info),
    ordr_mony : '1004',
    pay_type : 'PACA'
	// ordr_no : 'TEST123456789', // 실제 처리할 주문번호가 TEST123456789라면 ** 주문번호검증 **
	/*  ordr_no의 경우 결제창으로 전달하는 주문번호와
       실제 승인요청때 처리하는 주문번호가 동일해야하는 경우 검증처리바랍니다.
       다를경우 주문번호 검증은 하지 않으시기 바랍니다.                       */
  };
    
                                
  // 결제 API URL
  // 개발 : https://stg-spl.kcp.co.kr/gw/enc/v1/payment
  // 운영 : https://spl.kcp.co.kr/gw/enc/v1/payment
  fetch("https://stg-spl.kcp.co.kr/gw/enc/v1/payment", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req_data),
    })
    // 결제 API RES
    .then(response => {
      return response.json();
    })
    .then(data => {
      res.render('kcp_api_pay', {
        req_data : JSON.stringify(req_data),
        res_data : JSON.stringify(data),
        data : data
      });
    });   
});

function f_get_parm(val) {
  if ( val == null ) val = '';
  return val;
}

module.exports = router;
