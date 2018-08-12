#!/bin/bash

# Set up a local copy of Neural Monkey


# download the Neural Monkey package
wget https://github.com/ufal/neuralmonkey/archive/master.zip

# move the code to lib/neuralmonkey
unzip master.zip
rm master.zip
mv neuralmonkey-master neuralmonkey
mkdir lib
mv neuralmonkey lib/neuralmonkey

# install Neural Monkey dependencies
pip install --upgrade -r lib/neuralmonkey/requirements.txt

# create a symlink from the main macaque package 
# to lib/neuralmonkey/neuralmonkey (to allow imports
# of NM modules from inside the macaque package)
ln -s ../lib/neuralmonkey/neuralmonkey macaque/neuralmonkey
