from pycardano import Address, Network, PaymentSigningKey, PaymentVerificationKey
 
signing_key = PaymentSigningKey.generate()
signing_key.save("./credentials/account2.sk")
 
verification_key = PaymentVerificationKey.from_signing_key(signing_key)
 
address = Address(payment_part=verification_key.hash(), network=Network.TESTNET)
with open("./credentials/account2.addr", "w") as f:
    f.write(str(address))