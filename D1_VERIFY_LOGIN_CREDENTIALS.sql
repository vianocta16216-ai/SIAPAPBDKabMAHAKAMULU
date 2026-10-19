-- READ-ONLY: compares expected 100,000-iteration initial credentials with this DB.
-- Never changes records and never displays salts/password hashes.
WITH expected(username, expected_salt, expected_hash) AS (
  VALUES
    ('admin_8c88ed43','9b0630d95c4131ffbbd89650d32cb581','5c7cd79f2948e9ca55b0dfadd760cc26e784d3ebdc62e80901c11e08a03f58b7'),
    ('opd01_inspektorat_58d8','d3e0f67f33036eecb347eb6514f4a616','1add22f1d97b60e4229def1904708ff420f6e2f0b2d05333705251d06967ceab'),
    ('opd02_dinas_pariwisata_p_f99e','9f4e7f5c5b61d30eb2cb2803b297fa26','9cd11d02978846315a253c56d135b1207b56fa88b631c6b91f0651ecbbce0098'),
    ('opd03_dinas_pupr_perumah_61d5','99aed14b29b7050b50c76e06750b2136','440f7f490add1e49f285280b5c315a35c0c94f6e00c523f90e52406b0046b1bd'),
    ('opd04_satpol_pp_7245','9fe8404fb961ff5849505d173502e246','766bf79e56ee6da1bd8e5eb4749768e55cd2fa730fa15435d3be026f85d35c56'),
    ('opd05_bpbd_9e6d','28c3acc241483439c182a05d68fa6cb8','e4f204e4c253a3073f19796693175b8426c16e5f9e5c8857f7b43f32f5747812'),
    ('opd06_dinsos_pppa_0fb8','e45652990af0ed2a0b4a14808d901f50','07c927a187bc87d9484e3617dc23c2d1817c045226c14983eb3e0be43f322ce0'),
    ('opd07_ketahanan_pangan_p_d217','d1159542517ad16bebf93072cca8c89f','d27fca90d55e0fb8a1f85eb580ddcdd89328287860c8a9a8a038cd8cc39cc124'),
    ('opd08_dlh_c379','67c3e549ba5a94a5ef238761c0e8df10','184ab378cad0c79c47d7de8f2a9a045ac3d0b4d20050be896f35cee5363ac44d'),
    ('opd09_disdukcapil_0019','c3a4390537f79a2f99a247b48168af07','420553f47f3a66a3a72067db0f6777124c5afe119fdae97430784a2a62d34853'),
    ('opd10_dpmpk_572c','1ce461df0cdf0f21d15ea6fdd8e0eb3a','66de5636f5d47ed2ca05b75a7cd8a0768764c0afeb44f9fda17bde6d31fc4ae1'),
    ('opd11_dishub_c131','b87f97736fa486e92b0e55b9b21965c9','232d856843cc91b20bee8475be3694c135135ffcb6415e02e353fa5f63138833'),
    ('opd12_diskominfo_statist_218c','5bed0a22e4a7e4944a6589f27b515aa7','496a2dcc96284bdcb1ff67a1b4bd9df9fc33ac76631a1500436f7ec1151fc7ce'),
    ('opd13_dpmptsp_cacd','d2fc79c22c7289e8cf10880fa98ee0a6','0f235524d4fc156885f0225aeb333c90f55aeb56dcdd5526f5241579da5864da'),
    ('opd14_setda_31f6','d9c17919673d091e4c708bf2260217e4','31b14de450d6e5515a3e1752420ce9567b96bf45dc26e02304a1a8f31be41a4d'),
    ('opd15_setwan_8b81','ccfe926f856475c7cf2d2f057230a6ef','edf528380d359015c60ce45350dc8b176ef686817a034a755bff8083c5bcf5a6'),
    ('opd16_bappedalitbang_ec1b','f42275c023fbd96e0f57c2a9e721f36a','4ecb3d13f719ba71c3f5f1a5884eb36a80dbd75a781350deeae677110b571502'),
    ('opd17_bapenda_9fe2','3157d1b18aa0083256f84aa827add1db','30e755f47807feebdfa7645b1e288f73c132f49a9a7c8b5da56601b7a1f212db'),
    ('opd18_bkpsdm_f88f','8d11ebd9ecfecbd98a0a277def28846b','30190b12d1f9125ecbe6c602ad1c75c97c16872232131b0fff41d48ffd61af7b'),
    ('opd19_bppd_81f6','a1dbbeaf691f26696796025b7b77dbe3','7855ee61db8f5a0d2c32183b8ea86ce09add127d65c39c7827e5bf34a5cf10f6'),
    ('opd20_kecamatan_long_apa_9140','b8bc82708f6ad94cb32f600fc5f59d8b','c3abeec4aefca93326f2d9194e6cca0f875ee95e366f155cdbace59d7e7cc20e'),
    ('opd21_kecamatan_long_pah_d4c1','c5ff3dfa156e54e8c57eb01347f8e96c','735f45c3b1181df18213c9c4e9c398bfaae0723c0ae5850aa499d422e8fde8ed'),
    ('opd22_kecamatan_long_bag_7d47','48e3342f7895d8ad929f058a83bce5fa','75d1616ef0c6fa8422b8cdb47b1f9e658987fb6ab092d237a80effbfc9255e2b'),
    ('opd23_kecamatan_laham_70ee','6bee05e971f1225efe87e5f668bbdcad','3b37db173f3b917770f5e137e7e15f6a670cd1576409a17218e5e4c6ab92db16'),
    ('opd24_kecamatan_long_hub_6942','00e47845d7dd040a5cae194668960528','fd2eba4998b58aa363adeda1bdc1d42acfb0c3ca6ff985e6f985a0999817b7e4'),
    ('opd25_bakesbangpol_8a90','1d8567eb74bf8c3e89561eeaa8b4beb7','0e9fd0b904baf7a46a7d298d4b5947dd479d8aa5a253c65612c19e6424682ba6'),
    ('opd26_puskesmas_long_bag_c5e6','eb5630130987c383f29d667aab4a8177','51f237b754c4411506b95adbd5b5cbf12c30ed7c6eb4b67ab019ca4d7de7f183'),
    ('opd27_dinkes_ppkb_1eb5','4becc4d0b83844a469fee39baff11f94','9a6249719954b1f3c15b585f9496e54752cd2643051097a1e1f44ef80bba1375'),
    ('opd28_bpkad_571e','06418d7059b179c521e92dccb128681a','1ce6b3f011145a841e923aa080eb629ba96c98e3400e7294ba9d581a18a6572e'),
    ('bpkad_verif_3124a0','e621b569fc0a93dc7d350237bc059370','3262ef08e3337738f02fdbc72e212cc37cd20fedfdd01629555b2c7d40d94397')
)
SELECT
  e.username,
  CASE
    WHEN u.username IS NULL THEN 'NOT_FOUND_IN_THIS_DATABASE'
    WHEN COALESCE(u.active, 0) != 1 THEN 'ACCOUNT_INACTIVE'
    WHEN lower(trim(COALESCE(u.password_salt, ''))) = e.expected_salt
     AND lower(trim(COALESCE(u.password_hash, ''))) = e.expected_hash
      THEN 'MATCH_EXPECTED_100K'
    ELSE 'HASH_OR_SALT_DOES_NOT_MATCH_EXPECTED_100K'
  END AS credential_status,
  COALESCE(u.must_change_password, -1) AS must_change_password
FROM expected e
LEFT JOIN users u ON u.username = e.username
ORDER BY e.username;
